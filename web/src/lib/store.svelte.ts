// Local copy of all projects and issues. The app renders from IndexedDB at
// once, then asks /api/v1/sync for whatever changed since the last sync.
// Writes go to the server first (offline writes come later) and then sync.

import { api, ApiError, SessionExpired, type Issue, type Project, type Status } from './api';

const DB_NAME = 'pm';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

interface Snapshot {
  since: string | null;
  projects: Project[];
  issues: Issue[];
  labels: string[];
}

export const OPEN: Status[] = ['backlog', 'todo', 'in_progress', 'in_review'];

class Store {
  projects = $state<Record<string, Project>>({});
  issues = $state<Record<string, Issue>>({});
  labels = $state<string[]>([]);
  since: string | null = null;
  loaded = $state(false);
  syncing = $state(false);
  online = $state(navigator.onLine);
  sessionExpired = $state(false);
  syncError = $state<string | null>(null);

  /** Live (not deleted) issues. */
  live = $derived(Object.values(this.issues).filter((i) => !i.deleted));
  byIdentifier = $derived(new Map(this.live.map((i) => [i.identifier, i])));
  childrenOf = $derived.by(() => {
    const map = new Map<string, Issue[]>();
    for (const i of this.live) {
      if (!i.parent_id) continue;
      const list = map.get(i.parent_id) ?? [];
      list.push(i);
      map.set(i.parent_id, list);
    }
    return map;
  });
  projectList = $derived(
    Object.values(this.projects).sort((a, b) => {
      const rank = { active: 0, paused: 1, archived: 2 } as const;
      return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
    }),
  );

  constructor() {
    addEventListener('online', () => {
      this.online = true;
      this.sync();
    });
    addEventListener('offline', () => (this.online = false));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.sync();
    });
  }

  async init() {
    try {
      const snap = await idbGet<Snapshot>('snapshot');
      if (snap) this.apply(snap.projects, snap.issues, snap.labels, snap.since);
    } catch {
      // Private mode or blocked storage: run from the network only.
    }
    this.loaded = true;
    await this.sync();
  }

  private apply(projects: Project[], issues: Issue[], labels: string[] | null, since: string | null) {
    const p = { ...this.projects };
    for (const x of projects) p[x.key] = x;
    const i = { ...this.issues };
    for (const x of issues) i[x.id] = x;
    this.projects = p;
    this.issues = i;
    if (labels) this.labels = labels;
    this.since = since;
  }

  private pending: Promise<void> | null = null;

  /** Pull changes from the server. Concurrent calls share one request. */
  sync(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.doSync().finally(() => (this.pending = null));
    return this.pending;
  }

  private async doSync() {
    if (!navigator.onLine) return;
    this.syncing = true;
    try {
      const res = await api.sync(this.since ?? undefined);
      // Overlap by a few seconds so a write committed during the last sync is not missed.
      const since = new Date(new Date(res.server_time).getTime() - 10_000).toISOString();
      this.apply(res.projects, res.issues, res.labels.map((l) => l.name).sort(), since);
      this.syncError = null;
      this.sessionExpired = false;
      await idbSet('snapshot', {
        since,
        projects: $state.snapshot(Object.values(this.projects)),
        issues: $state.snapshot(Object.values(this.issues)),
        labels: $state.snapshot(this.labels),
      } satisfies Snapshot).catch(() => {});
    } catch (e) {
      this.handleError(e);
    } finally {
      this.syncing = false;
    }
  }

  handleError(e: unknown) {
    if (e instanceof SessionExpired) this.sessionExpired = true;
    else if (e instanceof ApiError) this.syncError = e.message;
    else if (!navigator.onLine) this.online = false;
    else this.syncError = String((e as Error)?.message ?? e);
  }

  projectIssues(key: string) {
    return this.live.filter((i) => i.project === key);
  }

  counts(key: string) {
    const counts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, canceled: 0 } as Record<Status, number>;
    for (const i of this.live) if (i.project === key) counts[i.status]++;
    const total = counts.backlog + counts.todo + counts.in_progress + counts.in_review + counts.done;
    return { counts, total, progress: total ? counts.done / total : 0 };
  }

  subIssueCount(issue: Issue) {
    const kids = this.childrenOf.get(issue.id);
    if (!kids?.length) return null;
    return { total: kids.length, done: kids.filter((k) => k.status === 'done').length };
  }

  parentOf(issue: Issue) {
    return issue.parent_id ? (this.issues[issue.parent_id] ?? null) : null;
  }
}

export const store = new Store();

/** Sort for lists: priority (urgent first, none last), then manual order, then newest. */
export function issueOrder(a: Issue, b: Issue) {
  const pa = a.priority === 0 ? 5 : a.priority;
  const pb = b.priority === 0 ? 5 : b.priority;
  return pa - pb || a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at);
}
