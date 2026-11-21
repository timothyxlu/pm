export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Zero Trust team domain, e.g. "timothyxlu.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN: string;
  /** AUD tag of the Access application covering the whole host. */
  ACCESS_AUD: string;
  /** Local development only: "1" skips auth. Never set in production. */
  DEV_AUTH_BYPASS?: string;
}

/** Who made a change. Shown in the activity log. */
export type Actor = 'me' | 'claude' | 'github';

export const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled'] as const;
export type Status = (typeof STATUSES)[number];

export const PROJECT_STATUSES = ['active', 'paused', 'done', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** 0 none, 1 urgent, 2 high, 3 medium, 4 low (same numbering as Linear). */
export const PRIORITY_NAMES = ['none', 'urgent', 'high', 'medium', 'low'] as const;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
