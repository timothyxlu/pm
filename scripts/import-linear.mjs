// Import one Linear project into pm, keeping Linear's identifiers (e.g. DEV-42),
// timestamps, status, priority, labels, due dates, parent/child links and comments.
//
// Usage:
//   LINEAR_API_KEY=lin_api_... node scripts/import-linear.mjs --project "sigion.ai" --key DEV [--local | --remote] [--dry-run]
//   node scripts/import-linear.mjs --input dump.json --key DEV --local      # from a saved dump
//
// It is idempotent: issues are upserted by identifier and comments are keyed by
// their Linear id, so it can be re-run safely. New pm issues in the project
// continue after the highest imported number.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(`--${name}`);

const projectName = opt('project');
const key = (opt('key') ?? '').toUpperCase();
const input = opt('input');
const dumpTo = opt('dump');
const dryRun = flag('dry-run');
const target = flag('remote') ? '--remote' : '--local';
if (!/^[A-Z][A-Z0-9]{0,9}$/.test(key)) throw new Error('--key must be a project key like DEV');
if (!input && !projectName) throw new Error('--project (Linear project name) or --input is required');

// ---------- fetch from Linear ----------

async function gql(query, variables) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.LINEAR_API_KEY },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`Linear API: ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

async function fetchLinear(name) {
  if (!process.env.LINEAR_API_KEY) throw new Error('Set LINEAR_API_KEY');
  const { projects } = await gql(
    `query($name: String!) { projects(filter: { name: { eq: $name } }, includeArchived: true) { nodes { id name description } } }`,
    { name },
  );
  if (projects.nodes.length !== 1) throw new Error(`Expected one Linear project named ${name}, found ${projects.nodes.length}`);
  const project = projects.nodes[0];
  const issues = [];
  let after = null;
  for (;;) {
    const { project: p } = await gql(
      `query($id: String!, $after: String) {
        project(id: $id) {
          issues(first: 25, after: $after, includeArchived: true) {
            pageInfo { hasNextPage endCursor }
            nodes {
              identifier title description priority dueDate sortOrder createdAt completedAt canceledAt archivedAt
              state { name type }
              labels { nodes { name } }
              parent { identifier }
              comments(first: 100) { pageInfo { hasNextPage } nodes { id body createdAt user { name isMe } botActor { name } } }
            }
          }
        }
      }`,
      { id: project.id, after },
    );
    for (const i of p.issues.nodes) {
      if (i.comments.pageInfo?.hasNextPage) console.error(`warning: ${i.identifier} has more than 100 comments; only the first 100 are imported`);
    }
    issues.push(...p.issues.nodes);
    console.error(`fetched ${issues.length} issues`);
    if (!p.issues.pageInfo.hasNextPage) break;
    after = p.issues.pageInfo.endCursor;
  }
  return { project: { name: project.name, description: project.description }, issues };
}

// ---------- map to pm ----------

function mapStatus(state) {
  switch (state.type) {
    case 'triage':
    case 'backlog':
      return 'backlog';
    case 'unstarted':
      return 'todo';
    case 'started':
      return /review/i.test(state.name) ? 'in_review' : 'in_progress';
    case 'completed':
      return 'done';
    default: // canceled, duplicate
      return 'canceled';
  }
}

function mapComment(c) {
  const mine = c.user?.isMe;
  const author = c.user?.name ?? c.botActor?.name;
  const isBot = !c.user && c.botActor;
  const body = !mine && author ? `**${author}** (Linear):\n\n${c.body}` : c.body;
  return { source_id: `linear:${c.id}`, body, created_at: c.createdAt, actor: isBot ? 'github' : 'me' };
}

// ---------- SQL ----------

const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
// Stable ids so re-runs hit the same rows.
const stableId = (s) => {
  const h = createHash('sha256').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

function buildSql(dump) {
  const now = new Date().toISOString();
  const pid = `(SELECT id FROM projects WHERE key = ${q(key)})`;
  const iid = (identifier) => `(SELECT id FROM issues WHERE identifier = ${q(identifier)})`;
  const sql = [];
  sql.push(
    `INSERT INTO projects (id, key, name, description, status, created_at, updated_at) VALUES (${q(randomUUID())}, ${q(key)}, ${q(dump.project.name)}, ${q(dump.project.description)}, 'active', ${q(now)}, ${q(now)}) ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at;`,
  );
  const labels = new Map();
  for (const i of dump.issues) for (const l of i.labels.nodes) labels.set(l.name.toLowerCase(), l.name);
  for (const name of labels.values()) sql.push(`INSERT OR IGNORE INTO labels (id, name) VALUES (${q(randomUUID())}, ${q(name)});`);

  const stats = { issues: 0, comments: 0, parents: 0, byStatus: {} };
  let maxNumber = 0;
  const known = new Set(dump.issues.map((i) => i.identifier));
  const missingParents = [];
  for (const i of dump.issues) {
    const status = mapStatus(i.state);
    stats.issues++;
    stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;
    if (i.identifier.startsWith(`${key}-`)) maxNumber = Math.max(maxNumber, Number(i.identifier.slice(key.length + 1)));
    const completed = status === 'done' ? (i.completedAt ?? i.createdAt) : null;
    sql.push(
      `INSERT INTO issues (id, project_id, number, identifier, title, description, status, priority, parent_id, due_date, sort_order, created_at, updated_at, completed_at)
VALUES (${q(stableId(`issue:${i.identifier}`))}, ${pid}, NULL, ${q(i.identifier)}, ${q(i.title)}, ${q(i.description)}, ${q(status)}, ${q(i.priority ?? 0)}, NULL, ${q(i.dueDate)}, ${q(Date.parse(i.createdAt))}, ${q(i.createdAt)}, ${q(now)}, ${q(completed)})
ON CONFLICT(identifier) DO UPDATE SET project_id = excluded.project_id, title = excluded.title, description = excluded.description, status = excluded.status, priority = excluded.priority, due_date = excluded.due_date, created_at = excluded.created_at, updated_at = excluded.updated_at, completed_at = excluded.completed_at, deleted_at = NULL;`,
    );
    sql.push(`DELETE FROM issue_labels WHERE issue_id = ${iid(i.identifier)};`);
    for (const l of i.labels.nodes) {
      sql.push(`INSERT OR IGNORE INTO issue_labels (issue_id, label_id) SELECT ${iid(i.identifier)}, id FROM labels WHERE name = ${q(l.name)};`);
    }
    for (const c of i.comments.nodes) {
      const m = mapComment(c);
      stats.comments++;
      sql.push(
        `INSERT OR IGNORE INTO comments (id, issue_id, actor, body, created_at) VALUES (${q(`import:${m.source_id}`)}, ${iid(i.identifier)}, ${q(m.actor)}, ${q(m.body)}, ${q(m.created_at)});`,
      );
    }
    sql.push(
      `INSERT OR IGNORE INTO activity (id, issue_id, actor, action, data, created_at) VALUES (${q(stableId(`imported:${i.identifier}`))}, ${iid(i.identifier)}, 'claude', 'imported', ${q(JSON.stringify({ identifier: i.identifier, title: i.title, source: 'linear' }))}, ${q(now)});`,
    );
  }
  for (const i of dump.issues) {
    if (!i.parent) continue;
    if (!known.has(i.parent.identifier)) {
      missingParents.push(`${i.identifier} -> ${i.parent.identifier}`);
      continue;
    }
    stats.parents++;
    sql.push(`UPDATE issues SET parent_id = ${iid(i.parent.identifier)} WHERE identifier = ${q(i.identifier)};`);
  }
  if (maxNumber) sql.push(`UPDATE projects SET next_number = MAX(next_number, ${maxNumber + 1}), updated_at = ${q(now)} WHERE key = ${q(key)};`);
  return { sql: sql.join('\n'), stats: { ...stats, nextNumber: maxNumber + 1, missingParents } };
}

// ---------- run ----------

const dump = input ? JSON.parse(readFileSync(input, 'utf8')) : await fetchLinear(projectName);
if (dumpTo) writeFileSync(dumpTo, JSON.stringify(dump));
const { sql, stats } = buildSql(dump);
console.log(JSON.stringify(stats, null, 2));
if (dryRun) process.exit(0);

const file = `.import-${key}.sql`;
writeFileSync(file, sql);
execFileSync('npx', ['wrangler', 'd1', 'execute', 'pm', target, '--yes', '--file', file], { stdio: 'inherit' });
console.log(`Imported ${stats.issues} issues and ${stats.comments} comments into ${key}`);
