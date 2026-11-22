// GitHub pull request webhooks, Linear style.
//
// A pull request refers to an issue when its branch name or title contains the
// issue's identifier (e.g. branch `dev-123-fix-rss`, title "DEV-123 Fix RSS"),
// or when its description says "Fixes DEV-123" (or closes / resolves /
// completes ...). Those references close the issue when the PR merges.
// "Part of DEV-123" (or refs / related to / contributes to / towards) only
// links the PR and moves the issue to in progress; merging leaves it open.
// Identifiers that are mentioned in the description without one of these
// words are ignored, as in Linear.

const KEY = String.raw`[A-Za-z][A-Za-z0-9]{0,9}-\d+`;
// Identifier with no letter or digit glued on either side: matches `dev-123-fix`
// and `claude/dev-123`, but not `project-thread-5glbkx`.
const KEY_ANYWHERE = new RegExp(String.raw`(?<![A-Za-z0-9])(${KEY})(?![A-Za-z0-9])`, 'g');
const KEY_LIST = String.raw`${KEY}(?:\s*(?:,|&|\band\b)\s*${KEY})*`;
const CLOSING_WORDS = String.raw`close[sd]?|closing|fix(?:e[sd])?|fixing|resolve[sd]?|resolving|complete[sd]?|completing`;
const LINKING_WORDS = String.raw`refs?|references?|part\s+of|related\s+to|relates\s+to|contributes\s+to|towards?`;
const CLOSING_RE = new RegExp(String.raw`\b(?:${CLOSING_WORDS})\b:?\s+(${KEY_LIST})`, 'gi');
const LINKING_RE = new RegExp(String.raw`\b(?:${LINKING_WORDS})\b:?\s+(${KEY_LIST})`, 'gi');

function keysIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(KEY_ANYWHERE)].map((m) => m[1].toUpperCase());
}

function keysAfter(re: RegExp, text: string | null | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(re)].flatMap((m) => keysIn(m[1]));
}

export interface PrReferences {
  /** Issues this PR completes: merging moves them to done. */
  closing: string[];
  /** Issues this PR only contributes to. */
  linking: string[];
}

export function findReferences(pr: { branch: string; title: string; body: string | null }): PrReferences {
  const titleLinking = new Set(keysAfter(LINKING_RE, pr.title));
  const closing = new Set([
    ...keysIn(pr.branch),
    ...keysIn(pr.title).filter((k) => !titleLinking.has(k)),
    ...keysAfter(CLOSING_RE, pr.body),
  ]);
  const linking = new Set([...titleLinking, ...keysAfter(LINKING_RE, pr.body)].filter((k) => !closing.has(k)));
  return { closing: [...closing], linking: [...linking] };
}

/** Checks GitHub's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body). */
export async function verifySignature(secret: string, body: string, header: string | null): Promise<boolean> {
  const hex = header?.startsWith('sha256=') ? header.slice(7) : null;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) return false;
  const sig = new Uint8Array(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify',
  ]);
  // subtle.verify compares in constant time.
  return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(body));
}

/** The parts of a pull_request webhook payload we use. */
export interface PullRequestEvent {
  action: string;
  repository: { full_name: string };
  pull_request: {
    number: number;
    html_url: string;
    title: string;
    body: string | null;
    state: 'open' | 'closed';
    draft?: boolean;
    merged?: boolean;
    head: { ref: string };
  };
}

/** What a PR event asks of the issues it refers to. */
export type PrStage = 'started' | 'review' | 'merged' | 'closed';

export function stageOf(event: PullRequestEvent): PrStage | null {
  const pr = event.pull_request;
  if (event.action === 'closed') return pr.merged ? 'merged' : 'closed';
  if (pr.state !== 'open') return null;
  if (event.action === 'review_requested') return pr.draft ? 'started' : 'review';
  if (['opened', 'reopened', 'edited', 'ready_for_review', 'converted_to_draft', 'synchronize'].includes(event.action)) return 'started';
  return null;
}

export function linkState(event: PullRequestEvent): string {
  const pr = event.pull_request;
  if (pr.state === 'closed') return pr.merged ? 'merged' : 'closed';
  return pr.draft ? 'draft' : 'open';
}
