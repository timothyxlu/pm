// Thin client for /api/v1. Cloudflare Access guards the API with a cookie, so
// an expired session shows up as a redirect to the Access login page (which
// fetch cannot follow across origins) or as a 401 from the Worker.

export const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled'] as const;
export type Status = (typeof STATUSES)[number];

export interface Project {
  key: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'archived';
  github_repos: string[];
  next_number: number;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  number: number | null;
  identifier: string;
  project: string;
  title: string;
  description: string | null;
  status: Status;
  priority: number;
  labels: string[];
  parent_id: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted: boolean;
}

export interface IssueRef {
  identifier: string;
  title: string;
  status: Status;
}

export interface IssueDetail {
  identifier: string;
  project: string;
  project_name: string;
  title: string;
  description: string | null;
  status: Status;
  priority: number;
  labels: string[];
  due_date: string | null;
  parent: IssueRef | null;
  children: IssueRef[];
  github: { repo: string; kind: string; number: number; title: string | null; url: string; state: string | null }[];
  comments: { actor: string; body: string; created_at: string }[];
  activity: { actor: string; action: string; data: any; created_at: string }[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface SyncResponse {
  server_time: string;
  projects: Project[];
  issues: Issue[];
  labels: { name: string; color: string | null }[];
}

export interface Token {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface GithubStatus {
  connected: boolean;
  app?: { name: string; slug: string; html_url: string; owner: string | null; settings_url: string; install_url: string };
  installed?: boolean;
  accounts?: string[];
  webhook_url: string;
}

export class SessionExpired extends Error {}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'same-origin',
    redirect: 'manual',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.type === 'opaqueredirect' || res.status === 401) throw new SessionExpired('session expired');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
  return data as T;
}

export const api = {
  me: () => request<{ principal: { kind: string; email?: string }; actor: string }>('GET', '/me'),
  sync: (since?: string) => request<SyncResponse>('GET', `/sync${since ? `?since=${encodeURIComponent(since)}` : ''}`),
  issue: (id: string) => request<IssueDetail>('GET', `/issues/${encodeURIComponent(id)}`),
  createIssue: (input: Record<string, unknown>) => request<IssueDetail>('POST', '/issues', input),
  updateIssue: (id: string, input: Record<string, unknown>) =>
    request<IssueDetail>('PATCH', `/issues/${encodeURIComponent(id)}`, input),
  deleteIssue: (id: string) => request<unknown>('DELETE', `/issues/${encodeURIComponent(id)}`),
  comment: (id: string, body: string) => request<unknown>('POST', `/issues/${encodeURIComponent(id)}/comments`, { body }),
  createProject: (input: Record<string, unknown>) => request<unknown>('POST', '/projects', input),
  updateProject: (key: string, input: Record<string, unknown>) =>
    request<unknown>('PATCH', `/projects/${encodeURIComponent(key)}`, input),
  tokens: () => request<Token[]>('GET', '/tokens'),
  createToken: (name: string) => request<{ id: string; name: string; token: string }>('POST', '/tokens', { name }),
  revokeToken: (id: string) => request<unknown>('DELETE', `/tokens/${encodeURIComponent(id)}`),
  github: () => request<GithubStatus>('GET', '/integrations/github'),
  githubManifest: () => request<{ action: string; manifest: unknown }>('POST', '/integrations/github/manifest'),
  githubRepos: () =>
    request<{ selection: 'all' | 'selected' | null; repos: { full_name: string; html_url: string; private: boolean }[] }>(
      'GET',
      '/integrations/github/repos',
    ),
  disconnectGithub: () => request<GithubStatus>('DELETE', '/integrations/github'),
};
