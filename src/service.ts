import { z } from 'zod';
import { findReferences, linkState, PrStage, PullRequestEvent, stageOf } from './github';
import { Actor, HttpError, PROJECT_STATUSES, STATUSES, Status } from './types';

// Shared business logic. The REST API and the MCP server both call these
// functions, so the two entry points always behave the same way.

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

const KEY_RE = /^[A-Z][A-Z0-9]{0,9}$/;
export const IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

// ---------- input schemas (shared by REST and MCP) ----------

export const projectInput = z.object({
  key: z.string().describe('Project key, e.g. "BLOG". Used as the identifier prefix of new issues.'),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  github_repos: z.array(z.string()).optional().describe('Repos like "timothyxlu/blog" that belong to this project'),
});
export type ProjectInput = z.infer<typeof projectInput>;

export const issueInput = z.object({
  identifier: z.string().optional().describe('Omit to create a new issue; pass e.g. "BLOG-12" to update it'),
  project: z.string().optional().describe('Project key. Required when creating; pass to move an issue'),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional().describe('Markdown'),
  status: z.enum(STATUSES).optional(),
  priority: z.number().int().min(0).max(4).optional().describe('0 none, 1 urgent, 2 high, 3 medium, 4 low'),
  labels: z.array(z.string()).optional().describe('Replaces the full label set'),
  parent: z.string().nullable().optional().describe('Parent issue identifier, or null to clear'),
  due_date: z.string().nullable().optional().describe('YYYY-MM-DD, or null to clear'),
  sort_order: z.number().optional(),
});
export type IssueInput = z.infer<typeof issueInput>;

export const listIssuesInput = z.object({
  project: z.string().optional().describe('Project key'),
  status: z.array(z.enum(STATUSES)).optional().describe('Defaults to all open statuses (not done/canceled)'),
  label: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  parent: z.string().optional().describe('Only sub-issues of this issue (e.g. BLOG-12); all statuses unless status is given'),
  top_level: z.boolean().optional().describe('Only issues without a parent'),
  query: z.string().optional().describe('Full-text search over identifier, title and description'),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});
export type ListIssuesInput = z.infer<typeof listIssuesInput>;

const OPEN_STATUSES: Status[] = ['backlog', 'todo', 'in_progress', 'in_review'];

// ---------- helpers ----------

async function logActivity(db: D1Database, issueId: string | null, actor: Actor, action: string, data?: unknown) {
  return db
    .prepare('INSERT INTO activity (id, issue_id, actor, action, data, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(newId(), issueId, actor, action, data === undefined ? null : JSON.stringify(data), now());
}

async function projectByKey(db: D1Database, key: string) {
  const row = await db.prepare('SELECT * FROM projects WHERE key = ?').bind(key.toUpperCase()).first<ProjectRow>();
  if (!row) throw new HttpError(404, `Project ${key} not found`);
  return row;
}

async function issueRowByIdentifier(db: D1Database, identifier: string) {
  const row = await db
    .prepare('SELECT * FROM issues WHERE identifier = ? AND deleted_at IS NULL')
    .bind(identifier.toUpperCase())
    .first<IssueRow>();
  if (!row) throw new HttpError(404, `Issue ${identifier} not found`);
  return row;
}

interface ProjectRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  github_repos: string;
  next_number: number;
  created_at: string;
  updated_at: string;
}

interface IssueRow {
  id: string;
  project_id: string;
  number: number | null;
  identifier: string;
  title: string;
  description: string | null;
  status: Status;
  priority: number;
  parent_id: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

function presentProject(p: ProjectRow) {
  return {
    key: p.key,
    name: p.name,
    description: p.description,
    status: p.status,
    github_repos: JSON.parse(p.github_repos || '[]') as string[],
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

// ---------- projects ----------

export async function listProjects(db: D1Database, includeArchived = false) {
  const { results } = await db
    .prepare(
      `SELECT p.*,
         SUM(CASE WHEN i.status = 'backlog' THEN 1 ELSE 0 END) AS n_backlog,
         SUM(CASE WHEN i.status = 'todo' THEN 1 ELSE 0 END) AS n_todo,
         SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) AS n_in_progress,
         SUM(CASE WHEN i.status = 'in_review' THEN 1 ELSE 0 END) AS n_in_review,
         SUM(CASE WHEN i.status = 'done' THEN 1 ELSE 0 END) AS n_done,
         SUM(CASE WHEN i.status = 'canceled' THEN 1 ELSE 0 END) AS n_canceled
       FROM projects p
       LEFT JOIN issues i ON i.project_id = p.id AND i.deleted_at IS NULL
       ${includeArchived ? '' : "WHERE p.status != 'archived'"}
       GROUP BY p.id
       ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, p.name`,
    )
    .all<ProjectRow & Record<string, number>>();
  return results.map((r) => {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, Number(r[`n_${s}`] ?? 0)])) as Record<Status, number>;
    const total = STATUSES.filter((s) => s !== 'canceled').reduce((a, s) => a + counts[s], 0);
    return {
      ...presentProject(r),
      counts,
      progress: total === 0 ? 0 : Math.round((counts.done / total) * 100) / 100,
    };
  });
}

export async function getProject(db: D1Database, key: string) {
  const p = await projectByKey(db, key);
  const all = await listProjects(db, true);
  const summary = all.find((x) => x.key === p.key)!;
  const active = await listIssues(db, { project: p.key, status: ['in_progress', 'in_review', 'todo'], limit: 100 });
  return { ...summary, open_issues: active.issues };
}

export async function saveProject(db: D1Database, input: ProjectInput, actor: Actor) {
  const key = input.key.toUpperCase();
  if (!KEY_RE.test(key)) throw new HttpError(400, 'Project key must be 1-10 letters/digits starting with a letter');
  const existing = await db.prepare('SELECT * FROM projects WHERE key = ?').bind(key).first<ProjectRow>();
  const ts = now();
  if (!existing) {
    if (!input.name) throw new HttpError(400, 'name is required when creating a project');
    await db.batch([
      db
        .prepare(
          `INSERT INTO projects (id, key, name, description, status, github_repos, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          key,
          input.name,
          input.description ?? null,
          input.status ?? 'active',
          JSON.stringify(input.github_repos ?? []),
          ts,
          ts,
        ),
      await logActivity(db, null, actor, 'project_created', { key }),
    ]);
  } else {
    await db.batch([
      db
        .prepare(
          `UPDATE projects SET name = ?, description = ?, status = ?, github_repos = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(
          input.name ?? existing.name,
          input.description === undefined ? existing.description : input.description,
          input.status ?? existing.status,
          input.github_repos ? JSON.stringify(input.github_repos) : existing.github_repos,
          ts,
          existing.id,
        ),
      await logActivity(db, null, actor, 'project_updated', { key, changes: input }),
    ]);
  }
  return presentProject((await projectByKey(db, key))!);
}

// ---------- issues ----------

export async function listIssues(db: D1Database, input: ListIssuesInput) {
  const where: string[] = ['i.deleted_at IS NULL'];
  const binds: unknown[] = [];
  if (input.project) {
    where.push('p.key = ?');
    binds.push(input.project.toUpperCase());
  }
  if (input.parent) {
    where.push('i.parent_id = (SELECT id FROM issues WHERE identifier = ?)');
    binds.push(input.parent.toUpperCase());
  }
  if (input.top_level) where.push('i.parent_id IS NULL');
  const statuses = input.status?.length
    ? input.status
    : input.query || input.parent
      ? [...STATUSES]
      : OPEN_STATUSES;
  where.push(`i.status IN (${statuses.map(() => '?').join(',')})`);
  binds.push(...statuses);
  if (input.priority !== undefined) {
    where.push('i.priority = ?');
    binds.push(input.priority);
  }
  if (input.label) {
    where.push(
      'EXISTS (SELECT 1 FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id = i.id AND l.name = ?)',
    );
    binds.push(input.label);
  }
  if (input.query) {
    where.push('i.rowid IN (SELECT rowid FROM issues_fts WHERE issues_fts MATCH ?)');
    binds.push(ftsQuery(input.query));
  }
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const { results } = await db
    .prepare(
      `SELECT i.*, p.key AS project_key,
         (SELECT group_concat(l.name, ',') FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id = i.id) AS label_names,
         (SELECT identifier FROM issues pi WHERE pi.id = i.parent_id) AS parent_identifier,
         (SELECT COUNT(*) FROM issues c WHERE c.parent_id = i.id AND c.deleted_at IS NULL AND c.status != 'canceled') AS n_children,
         (SELECT COUNT(*) FROM issues c WHERE c.parent_id = i.id AND c.deleted_at IS NULL AND c.status = 'done') AS n_children_done
       FROM issues i JOIN projects p ON p.id = i.project_id
       WHERE ${where.join(' AND ')}
       ORDER BY CASE i.status WHEN 'in_progress' THEN 0 WHEN 'in_review' THEN 1 WHEN 'todo' THEN 2 WHEN 'backlog' THEN 3 ELSE 4 END,
                CASE WHEN i.priority = 0 THEN 5 ELSE i.priority END, i.sort_order, i.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit + 1, offset)
    .all<SummaryRow>();
  const hasMore = results.length > limit;
  return {
    issues: results.slice(0, limit).map(presentIssueSummary),
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
  };
}

/** Turn free text into a safe FTS5 query: each word becomes a quoted prefix term. */
function ftsQuery(q: string) {
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/"/g, ''))
    .filter(Boolean);
  if (!terms.length) return '""';
  return terms.map((t) => `"${t}"*`).join(' ');
}

type SummaryRow = IssueRow & {
  project_key: string;
  label_names?: string | null;
  parent_identifier?: string | null;
  n_children?: number;
  n_children_done?: number;
};

function presentIssueSummary(r: SummaryRow) {
  return {
    identifier: r.identifier,
    project: r.project_key,
    title: r.title,
    status: r.status,
    priority: r.priority,
    labels: r.label_names ? r.label_names.split(',') : [],
    parent: r.parent_identifier ?? null,
    sub_issues: r.n_children ? { total: Number(r.n_children), done: Number(r.n_children_done ?? 0) } : null,
    due_date: r.due_date,
    updated_at: r.updated_at,
  };
}

export async function getIssue(db: D1Database, identifier: string) {
  const row = await issueRowByIdentifier(db, identifier);
  const [project, labels, comments, links, activity, parent, children] = await Promise.all([
    db.prepare('SELECT key, name FROM projects WHERE id = ?').bind(row.project_id).first<{ key: string; name: string }>(),
    db
      .prepare('SELECT l.name FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id = ? ORDER BY l.name')
      .bind(row.id)
      .all<{ name: string }>(),
    db
      .prepare('SELECT actor, body, created_at FROM comments WHERE issue_id = ? ORDER BY created_at')
      .bind(row.id)
      .all(),
    db
      .prepare('SELECT repo, kind, number, title, url, state, updated_at FROM github_links WHERE issue_id = ? ORDER BY updated_at DESC')
      .bind(row.id)
      .all(),
    db
      .prepare('SELECT actor, action, data, created_at FROM activity WHERE issue_id = ? ORDER BY created_at DESC LIMIT 20')
      .bind(row.id)
      .all<{ actor: string; action: string; data: string | null; created_at: string }>(),
    row.parent_id
      ? db.prepare('SELECT identifier, title, status FROM issues WHERE id = ?').bind(row.parent_id).first()
      : Promise.resolve(null),
    db
      .prepare('SELECT identifier, title, status FROM issues WHERE parent_id = ? AND deleted_at IS NULL ORDER BY created_at')
      .bind(row.id)
      .all(),
  ]);
  return {
    identifier: row.identifier,
    project: project?.key,
    project_name: project?.name,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    labels: labels.results.map((l) => l.name),
    due_date: row.due_date,
    parent,
    children: children.results,
    github: links.results,
    comments: comments.results,
    activity: activity.results.map((a) => ({ ...a, data: a.data ? JSON.parse(a.data) : null })),
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  };
}

async function resolveLabelIds(db: D1Database, names: string[]) {
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    let row = await db.prepare('SELECT id FROM labels WHERE name = ?').bind(name).first<{ id: string }>();
    if (!row) {
      const id = newId();
      await db.prepare('INSERT INTO labels (id, name) VALUES (?, ?)').bind(id, name).run();
      row = { id };
    }
    ids.push(row.id);
  }
  return [...new Set(ids)];
}

export async function saveIssue(db: D1Database, input: IssueInput, actor: Actor) {
  const ts = now();
  const stmts: D1PreparedStatement[] = [];
  let parentId: string | null | undefined;
  if (input.parent !== undefined) {
    parentId = input.parent === null ? null : (await issueRowByIdentifier(db, input.parent)).id;
  }

  // ----- create -----
  if (!input.identifier) {
    if (!input.project) throw new HttpError(400, 'project is required when creating an issue');
    if (!input.title) throw new HttpError(400, 'title is required when creating an issue');
    const project = await projectByKey(db, input.project);
    const id = newId();
    const status = input.status ?? 'todo';
    // Insert and bump the counter in one transaction so numbers never collide.
    stmts.push(
      db
        .prepare(
          `INSERT INTO issues (id, project_id, number, identifier, title, description, status, priority, parent_id,
                               due_date, sort_order, created_at, updated_at, completed_at)
           SELECT ?, p.id, p.next_number, p.key || '-' || p.next_number, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           FROM projects p WHERE p.id = ?`,
        )
        .bind(
          id,
          input.title,
          input.description ?? null,
          status,
          input.priority ?? 0,
          parentId ?? null,
          input.due_date ?? null,
          input.sort_order ?? Date.now(),
          ts,
          ts,
          status === 'done' ? ts : null,
          project.id,
        ),
      db.prepare('UPDATE projects SET next_number = next_number + 1, updated_at = ? WHERE id = ?').bind(ts, project.id),
      await logActivity(db, id, actor, 'created', { identifier: `${project.key}-${project.next_number}`, title: input.title }),
    );
    if (input.labels?.length) {
      for (const labelId of await resolveLabelIds(db, input.labels)) {
        stmts.push(db.prepare('INSERT INTO issue_labels (issue_id, label_id) VALUES (?, ?)').bind(id, labelId));
      }
    }
    await db.batch(stmts);
    const created = await db.prepare('SELECT identifier FROM issues WHERE id = ?').bind(id).first<{ identifier: string }>();
    return getIssue(db, created!.identifier);
  }

  // ----- update -----
  const row = await issueRowByIdentifier(db, input.identifier);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const sets: string[] = [];
  const binds: unknown[] = [];
  const set = (col: keyof IssueRow, value: unknown) => {
    if (value === undefined || value === row[col]) return;
    changes[col] = { from: row[col], to: value };
    sets.push(`${col} = ?`);
    binds.push(value);
  };
  set('title', input.title);
  set('description', input.description);
  set('status', input.status);
  set('priority', input.priority);
  set('due_date', input.due_date);
  set('sort_order', input.sort_order);
  if (parentId !== undefined) {
    if (parentId === row.id) throw new HttpError(400, 'An issue cannot be its own parent');
    if (parentId) {
      // Refuse cycles: the new parent must not be this issue or one of its descendants.
      const cycle = await db
        .prepare(
          `WITH RECURSIVE ancestors(id, depth) AS (
             SELECT parent_id, 1 FROM issues WHERE id = ?
             UNION ALL
             SELECT i.parent_id, a.depth + 1 FROM issues i JOIN ancestors a ON i.id = a.id
             WHERE a.id IS NOT NULL AND a.depth < 50
           )
           SELECT 1 AS hit FROM ancestors WHERE id = ? LIMIT 1`,
        )
        .bind(parentId, row.id)
        .first();
      if (cycle) throw new HttpError(400, `${input.parent} is a sub-issue of ${row.identifier}; that would create a cycle`);
    }
    set('parent_id', parentId);
  }
  if (input.project) {
    // Moving keeps the identifier, so links, branches and PRs keep matching.
    const project = await projectByKey(db, input.project);
    if (project.id !== row.project_id) {
      changes.project = { from: row.project_id, to: project.key };
      sets.push('project_id = ?', 'number = NULL');
      binds.push(project.id);
    }
  }
  if (input.status && input.status !== row.status) {
    sets.push('completed_at = ?');
    binds.push(input.status === 'done' ? ts : null);
  }
  if (input.labels) {
    const labelIds = await resolveLabelIds(db, input.labels);
    stmts.push(db.prepare('DELETE FROM issue_labels WHERE issue_id = ?').bind(row.id));
    for (const labelId of labelIds) {
      stmts.push(db.prepare('INSERT INTO issue_labels (issue_id, label_id) VALUES (?, ?)').bind(row.id, labelId));
    }
    changes.labels = { from: null, to: input.labels };
  }
  if (!Object.keys(changes).length) return getIssue(db, row.identifier);
  sets.push('updated_at = ?');
  binds.push(ts);
  stmts.unshift(db.prepare(`UPDATE issues SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, row.id));
  stmts.push(await logActivity(db, row.id, actor, 'updated', changes));
  await db.batch(stmts);
  return getIssue(db, row.identifier);
}

export async function deleteIssue(db: D1Database, identifier: string, actor: Actor) {
  const row = await issueRowByIdentifier(db, identifier);
  const ts = now();
  await db.batch([
    db.prepare('UPDATE issues SET deleted_at = ?, updated_at = ? WHERE id = ?').bind(ts, ts, row.id),
    await logActivity(db, row.id, actor, 'deleted'),
  ]);
  return { identifier: row.identifier, deleted: true };
}

export async function addComment(db: D1Database, identifier: string, body: string, actor: Actor) {
  if (!body.trim()) throw new HttpError(400, 'Comment body is empty');
  const row = await issueRowByIdentifier(db, identifier);
  const ts = now();
  const id = newId();
  await db.batch([
    db
      .prepare('INSERT INTO comments (id, issue_id, actor, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, row.id, actor, body, ts),
    db.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').bind(ts, row.id),
    await logActivity(db, row.id, actor, 'commented'),
  ]);
  return { id, identifier: row.identifier, actor, body, created_at: ts };
}

const GITHUB_URL_RE = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(pull|issues)\/(\d+)/;

export async function linkGithub(
  db: D1Database,
  identifier: string,
  url: string,
  actor: Actor,
  extra: { title?: string | null; state?: string | null } = {},
) {
  const m = GITHUB_URL_RE.exec(url);
  if (!m) throw new HttpError(400, 'Expected a GitHub pull request or issue URL');
  const [, repo, path, num] = m;
  const kind = path === 'pull' ? 'pr' : 'issue';
  const row = await issueRowByIdentifier(db, identifier);
  const ts = now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO github_links (id, issue_id, repo, kind, number, title, url, state, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (issue_id, repo, kind, number) DO UPDATE SET
           title = COALESCE(excluded.title, title), state = COALESCE(excluded.state, state), updated_at = excluded.updated_at`,
      )
      .bind(newId(), row.id, repo, kind, Number(num), extra.title ?? null, m[0], extra.state ?? null, ts),
    db.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').bind(ts, row.id),
    await logActivity(db, row.id, actor, 'linked_github', { repo, kind, number: Number(num) }),
  ]);
  return { identifier: row.identifier, repo, kind, number: Number(num), url: m[0] };
}

export async function listLabels(db: D1Database) {
  const { results } = await db.prepare('SELECT name, color FROM labels ORDER BY name').all();
  return results;
}

/** What happened in the last N days: finished, started, and still-open work per project. */
export async function weeklySummary(db: D1Database, days = 7) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [completed, created, inFlight] = await Promise.all([
    db
      .prepare(
        `SELECT i.identifier, i.title, p.key AS project, i.completed_at FROM issues i JOIN projects p ON p.id = i.project_id
         WHERE i.status = 'done' AND i.completed_at >= ? AND i.deleted_at IS NULL ORDER BY i.completed_at DESC`,
      )
      .bind(since)
      .all(),
    db
      .prepare(
        `SELECT i.identifier, i.title, p.key AS project, i.status FROM issues i JOIN projects p ON p.id = i.project_id
         WHERE i.created_at >= ? AND i.deleted_at IS NULL ORDER BY i.created_at DESC`,
      )
      .bind(since)
      .all(),
    db
      .prepare(
        `SELECT i.identifier, i.title, p.key AS project, i.status, i.updated_at FROM issues i JOIN projects p ON p.id = i.project_id
         WHERE i.status IN ('in_progress','in_review') AND i.deleted_at IS NULL ORDER BY i.updated_at`,
      )
      .all(),
  ]);
  return { since, days, completed: completed.results, created: created.results, in_progress: inFlight.results };
}

/** Incremental sync for the web app: everything changed since a timestamp. */
export async function sync(db: D1Database, since?: string) {
  const s = since ?? '1970-01-01T00:00:00.000Z';
  const [projects, issues, labels] = await Promise.all([
    db.prepare('SELECT * FROM projects WHERE updated_at > ?').bind(s).all<ProjectRow>(),
    db
      .prepare(
        `SELECT i.*, p.key AS project_key,
           (SELECT group_concat(l.name, ',') FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id = i.id) AS label_names
         FROM issues i JOIN projects p ON p.id = i.project_id WHERE i.updated_at > ?`,
      )
      .bind(s)
      .all<IssueRow & { project_key: string; label_names: string | null }>(),
    db.prepare('SELECT name, color FROM labels').all(),
  ]);
  return {
    server_time: now(),
    projects: projects.results.map((p) => ({ ...presentProject(p), next_number: p.next_number })),
    issues: issues.results.map((r) => ({
      id: r.id,
      number: r.number,
      ...presentIssueSummary(r),
      description: r.description,
      parent_id: r.parent_id,
      sort_order: r.sort_order,
      created_at: r.created_at,
      completed_at: r.completed_at,
      deleted: r.deleted_at !== null,
    })),
    labels: labels.results,
  };
}

// ---------- API tokens ----------

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createToken(db: D1Database, name: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = 'pm_' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const id = newId();
  await db
    .prepare('INSERT INTO api_tokens (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, name, await sha256Hex(token), now())
    .run();
  return { id, name, token };
}

export async function listTokens(db: D1Database) {
  const { results } = await db
    .prepare('SELECT id, name, created_at, last_used_at, revoked_at FROM api_tokens ORDER BY created_at DESC')
    .all();
  return results;
}

export async function revokeToken(db: D1Database, id: string) {
  const r = await db.prepare('UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now(), id).run();
  if (!r.meta.changes) throw new HttpError(404, 'Token not found or already revoked');
  return { id, revoked: true };
}

// ---------- import (migration from Linear etc.) ----------

export const importIssuesInput = z.object({
  project: z.string().describe('Project key the issues go into (must exist)'),
  issues: z
    .array(
      z.object({
        identifier: z.string().describe('Original id to keep, e.g. "ENG-42"'),
        title: z.string().min(1),
        description: z.string().nullable().optional().describe('Markdown'),
        status: z.enum(STATUSES),
        priority: z.number().int().min(0).max(4).optional(),
        labels: z.array(z.string()).optional(),
        parent: z.string().nullable().optional().describe('Parent identifier; may be in this batch or already imported'),
        due_date: z.string().nullable().optional(),
        sort_order: z.number().optional(),
        created_at: z.string().describe('ISO timestamp from the source system'),
        completed_at: z.string().nullable().optional(),
        comments: z
          .array(
            z.object({
              source_id: z.string().describe('Comment id in the source system; makes re-imports idempotent'),
              body: z.string().min(1),
              created_at: z.string(),
              actor: z.enum(['me', 'claude', 'github']).optional().describe('Defaults to me'),
            }),
          )
          .optional(),
      }),
    )
    .min(1)
    .max(50),
});
export type ImportIssuesInput = z.infer<typeof importIssuesInput>;

/**
 * Insert or update issues keeping their original identifiers and timestamps.
 * Idempotent: re-running with the same data updates rows in place, and
 * comments are keyed by their source id. updated_at is set to now so that
 * clients syncing incrementally pick the rows up.
 */
export async function importIssues(db: D1Database, input: ImportIssuesInput, actor: Actor) {
  const project = await projectByKey(db, input.project);
  const ts = now();
  const issues = input.issues.map((i) => ({ ...i, identifier: i.identifier.toUpperCase(), parent: i.parent?.toUpperCase() ?? i.parent }));
  for (const i of issues) {
    if (!IDENTIFIER_RE.test(i.identifier)) throw new HttpError(400, `Invalid identifier ${i.identifier}`);
  }

  // One lookup for everything referenced: the issues themselves and their parents.
  const refs = [...new Set(issues.flatMap((i) => [i.identifier, ...(i.parent ? [i.parent] : [])]))];
  const existing = new Map<string, { id: string; project_id: string; deleted_at: string | null }>();
  for (let k = 0; k < refs.length; k += 90) {
    const chunk = refs.slice(k, k + 90);
    const { results } = await db
      .prepare(`SELECT id, identifier, project_id, deleted_at FROM issues WHERE identifier IN (${chunk.map(() => '?').join(',')})`)
      .bind(...chunk)
      .all<{ id: string; identifier: string; project_id: string; deleted_at: string | null }>();
    for (const r of results) existing.set(r.identifier, r);
  }
  for (const i of issues) {
    const e = existing.get(i.identifier);
    if (e && e.project_id !== project.id) throw new HttpError(409, `${i.identifier} already exists in another project`);
  }
  const ids = new Map<string, string>();
  for (const i of issues) ids.set(i.identifier, existing.get(i.identifier)?.id ?? newId());

  // Label names are case-insensitive (COLLATE NOCASE), so resolve one name per lowercase key.
  const labelNames = new Map<string, string>();
  for (const l of issues.flatMap((i) => i.labels ?? [])) {
    const n = l.trim();
    if (n && !labelNames.has(n.toLowerCase())) labelNames.set(n.toLowerCase(), n);
  }
  const labelId = new Map<string, string>();
  for (const [key, name] of labelNames) labelId.set(key, (await resolveLabelIds(db, [name]))[0]);

  const stmts: D1PreparedStatement[] = [];
  // Parents are set after every row exists, so a child may come before its parent in the batch.
  const parentStmts: D1PreparedStatement[] = [];
  const unresolved: string[] = [];
  let created = 0;
  let updated = 0;
  let comments = 0;
  let maxNumber = 0;
  const prefix = `${project.key}-`;

  for (const i of issues) {
    const id = ids.get(i.identifier)!;
    if (i.identifier.startsWith(prefix)) maxNumber = Math.max(maxNumber, Number(i.identifier.slice(prefix.length)));
    let parentId: string | null = null;
    if (i.parent) {
      parentId = ids.get(i.parent) ?? existing.get(i.parent)?.id ?? null;
      if (!parentId) unresolved.push(i.identifier);
      else parentStmts.push(db.prepare('UPDATE issues SET parent_id = ? WHERE id = ?').bind(parentId, id));
    } else if (i.parent === null) {
      parentStmts.push(db.prepare('UPDATE issues SET parent_id = NULL WHERE id = ?').bind(id));
    }
    const completedAt = i.status === 'done' ? (i.completed_at ?? i.created_at) : null;
    if (existing.has(i.identifier)) updated++;
    else created++;
    stmts.push(
      db
        .prepare(
          `INSERT INTO issues (id, project_id, number, identifier, title, description, status, priority, parent_id,
                               due_date, sort_order, created_at, updated_at, completed_at, deleted_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(identifier) DO UPDATE SET
             title = excluded.title, description = excluded.description, status = excluded.status,
             priority = excluded.priority,
             due_date = excluded.due_date, sort_order = excluded.sort_order, created_at = excluded.created_at,
             updated_at = excluded.updated_at, completed_at = excluded.completed_at, deleted_at = NULL`,
        )
        .bind(
          id,
          project.id,
          i.identifier,
          i.title,
          i.description ?? null,
          i.status,
          i.priority ?? 0,
          i.due_date ?? null,
          i.sort_order ?? Date.parse(i.created_at),
          i.created_at,
          ts,
          completedAt,
        ),
    );
    if (i.labels !== undefined) stmts.push(db.prepare('DELETE FROM issue_labels WHERE issue_id = ?').bind(id));
    for (const name of new Set((i.labels ?? []).map((l) => l.trim().toLowerCase()).filter(Boolean))) {
      stmts.push(db.prepare('INSERT OR IGNORE INTO issue_labels (issue_id, label_id) VALUES (?, ?)').bind(id, labelId.get(name)));
    }
    for (const c of i.comments ?? []) {
      comments++;
      stmts.push(
        db
          .prepare('INSERT OR IGNORE INTO comments (id, issue_id, actor, body, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(`import:${c.source_id}`, id, c.actor ?? 'me', c.body, c.created_at),
      );
    }
    if (!existing.has(i.identifier)) {
      stmts.push(await logActivity(db, id, actor, 'imported', { identifier: i.identifier, title: i.title }));
    }
  }
  stmts.push(...parentStmts);
  if (maxNumber) {
    // New issues continue after the highest imported number.
    stmts.push(
      db.prepare('UPDATE projects SET next_number = MAX(next_number, ?), updated_at = ? WHERE id = ?').bind(maxNumber + 1, ts, project.id),
    );
  } else {
    stmts.push(db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').bind(ts, project.id));
  }
  await db.batch(stmts);
  return { project: project.key, created, updated, comments, unresolved_parents: unresolved };
}

// ---------- GitHub pull requests (webhooks) ----------

/** Status moves for issues a pull request refers to. Only ever moves an issue forward. */
const PR_MOVES: Record<PrStage, { from: Status[]; to: Status; closingOnly: boolean } | null> = {
  started: { from: ['backlog', 'todo'], to: 'in_progress', closingOnly: false },
  review: { from: ['backlog', 'todo', 'in_progress'], to: 'in_review', closingOnly: false },
  merged: { from: ['backlog', 'todo', 'in_progress', 'in_review'], to: 'done', closingOnly: true },
  closed: null,
};

/**
 * Applies one pull_request webhook event: links the PR to every issue it
 * refers to (or refreshes the link's title and state) and moves those issues
 * along. Safe to replay: GitHub redelivers events, and every step only
 * changes something that is not already in its end state.
 */
export async function applyPullRequest(db: D1Database, event: PullRequestEvent) {
  const pr = event.pull_request;
  const repo = event.repository.full_name;
  const refs = findReferences({ branch: pr.head.ref, title: pr.title, body: pr.body });
  const wanted = [...refs.closing, ...refs.linking];
  // A PR that dropped a reference keeps its link; refresh it too.
  const { results: linkedRows } = await db
    .prepare(
      `SELECT i.identifier FROM github_links g JOIN issues i ON i.id = g.issue_id
       WHERE g.repo = ? AND g.kind = 'pr' AND g.number = ? AND i.deleted_at IS NULL`,
    )
    .bind(repo, pr.number)
    .all<{ identifier: string }>();
  const already = new Set(linkedRows.map((r) => r.identifier));
  const all = [...new Set([...wanted, ...already])];
  if (!all.length) return { repo, number: pr.number, issues: [] };

  const { results: issues } = await db
    .prepare(`SELECT * FROM issues WHERE identifier IN (${all.map(() => '?').join(',')}) AND deleted_at IS NULL`)
    .bind(...all)
    .all<IssueRow>();

  const stage = stageOf(event);
  const move = stage ? PR_MOVES[stage] : null;
  const state = linkState(event);
  const url = pr.html_url;
  const ts = now();
  const stmts: D1PreparedStatement[] = [];
  const out: { identifier: string; status: Status; moved_from?: Status }[] = [];

  for (const row of issues) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO github_links (id, issue_id, repo, kind, number, title, url, state, updated_at)
           VALUES (?, ?, ?, 'pr', ?, ?, ?, ?, ?)
           ON CONFLICT (issue_id, repo, kind, number) DO UPDATE SET
             title = excluded.title, url = excluded.url, state = excluded.state, updated_at = excluded.updated_at`,
        )
        .bind(newId(), row.id, repo, pr.number, pr.title, url, state, ts),
    );
    if (!already.has(row.identifier)) {
      stmts.push(await logActivity(db, row.id, 'github', 'linked_github', { repo, kind: 'pr', number: pr.number }));
    }
    const referenced = wanted.includes(row.identifier);
    const closing = refs.closing.includes(row.identifier);
    if (move && referenced && (closing || !move.closingOnly) && move.from.includes(row.status)) {
      stmts.push(
        db
          .prepare('UPDATE issues SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = ?')
          .bind(move.to, move.to === 'done' ? ts : null, ts, row.id, row.status),
        await logActivity(db, row.id, 'github', 'updated', { status: { from: row.status, to: move.to } }),
      );
      out.push({ identifier: row.identifier, status: move.to, moved_from: row.status });
    } else {
      stmts.push(db.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').bind(ts, row.id));
      out.push({ identifier: row.identifier, status: row.status });
    }
  }
  if (stmts.length) await db.batch(stmts);
  return { repo, number: pr.number, state, issues: out };
}
