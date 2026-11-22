// "Connect GitHub": create a private GitHub App for this MyPM with GitHub's
// app manifest flow, the way Linear's GitHub integration works.
//
//  1. The settings page asks for a manifest and POSTs it to GitHub as a form.
//     It names the one webhook URL, the events (pull requests) and read-only
//     permissions.
//  2. You confirm on github.com. GitHub sends the browser back to the callback
//     with a one-time code, which we swap for the app's id, webhook secret and
//     private key, and store them in D1.
//  3. The callback sends you on to install the app, where you pick "All
//     repositories". From then on GitHub delivers every PR event of those repos
//     to /webhooks/github, signed with the app's secret.
//
// The callback and setup URLs live under /api/v1, which sits behind Cloudflare
// Access like the rest of the app. That is fine because GitHub only redirects
// your browser there; it never calls them itself.

import { Env, HttpError } from './types';

const KEY = 'github_app';
const STATE_PREFIX = 'gh-manifest-state:';

export interface GithubApp {
  id: number;
  slug: string;
  name: string;
  html_url: string;
  owner: string | null;
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  pem: string;
  /** Legacy single installation; superseded by `installations`. */
  installation_id: number | null;
  /** Where the app is installed: your account and any organizations. */
  installations?: Installation[];
  created_at: string;
}

export interface Installation {
  id: number;
  account: string;
}

export function installsOf(app: GithubApp): Installation[] {
  if (app.installations) return app.installations;
  return app.installation_id != null ? [{ id: app.installation_id, account: app.owner ?? '' }] : [];
}

/** The app is public so it can go on organizations too; only installs you made count. */
export function isOurInstallation(app: GithubApp, id: number) {
  return installsOf(app).some((i) => i.id === id);
}

/** What the browser is allowed to see. */
export interface GithubAppStatus {
  connected: boolean;
  app?: { name: string; slug: string; html_url: string; owner: string | null; settings_url: string; install_url: string };
  installed?: boolean;
  accounts?: string[];
  webhook_url: string;
}

export async function loadApp(db: D1Database): Promise<GithubApp | null> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first<{ value: string }>();
  return row ? (JSON.parse(row.value) as GithubApp) : null;
}

async function saveApp(db: D1Database, app: GithubApp) {
  await db
    .prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3',
    )
    .bind(KEY, JSON.stringify(app), new Date().toISOString())
    .run();
}

export async function deleteApp(db: D1Database) {
  await db.prepare('DELETE FROM settings WHERE key = ?').bind(KEY).run();
}

export function webhookUrl(env: Env) {
  return `${env.PUBLIC_URL}/webhooks/github`;
}

export function status(env: Env, app: GithubApp | null): GithubAppStatus {
  if (!app) return { connected: false, webhook_url: webhookUrl(env) };
  return {
    connected: true,
    app: {
      name: app.name,
      slug: app.slug,
      html_url: app.html_url,
      owner: app.owner,
      settings_url: `https://github.com/settings/apps/${app.slug}`,
      install_url: `${app.html_url}/installations/new`,
    },
    installed: installsOf(app).length > 0,
    accounts: installsOf(app).map((i) => i.account),
    webhook_url: webhookUrl(env),
  };
}

/** The manifest, plus where to POST it. The state guards the callback. */
export async function startManifest(env: Env) {
  const state = crypto.randomUUID();
  await env.OAUTH_KV.put(STATE_PREFIX + state, '1', { expirationTtl: 900 });
  const base = env.PUBLIC_URL;
  const host = new URL(base).hostname;
  const manifest = {
    // GitHub App names are unique across GitHub and may not match an account
    // name, so plain "MyPM" is refused. It can be changed on the confirmation page.
    name: 'MyPM timothyxlu',
    url: base,
    description: `Links pull requests to issues in MyPM (${host}) and moves them like Linear.`,
    hook_attributes: { url: webhookUrl(env), active: true },
    redirect_url: `${base}/api/v1/integrations/github/callback`,
    setup_url: `${base}/api/v1/integrations/github/setup`,
    setup_on_update: true,
    // Public so it can be installed on organizations as well as your account.
    // Installs made by anyone else are ignored (see isOurInstallation).
    public: true,
    default_permissions: { pull_requests: 'read', metadata: 'read' },
    default_events: ['pull_request'],
  };
  return { action: `https://github.com/settings/apps/new?state=${encodeURIComponent(state)}`, manifest };
}

/** Swaps the one-time code from the manifest flow for the app's credentials. */
export async function finishManifest(env: Env, code: string, state: string): Promise<GithubApp> {
  const stateKey = STATE_PREFIX + state;
  if (!state || !(await env.OAUTH_KV.get(stateKey))) throw new HttpError(400, 'Unknown or expired state; start again from Settings');
  await env.OAUTH_KV.delete(stateKey);
  if (!/^[A-Za-z0-9_-]+$/.test(code)) throw new HttpError(400, 'Bad code');
  const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: 'POST',
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MyPM', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new HttpError(502, `GitHub refused the code (${res.status}); start again from Settings`);
  const data = (await res.json()) as {
    id: number;
    slug: string;
    name: string;
    html_url: string;
    owner?: { login?: string } | null;
    client_id: string;
    client_secret: string;
    webhook_secret: string;
    pem: string;
  };
  const app: GithubApp = {
    id: data.id,
    slug: data.slug,
    name: data.name,
    html_url: data.html_url,
    owner: data.owner?.login ?? null,
    client_id: data.client_id,
    client_secret: data.client_secret,
    webhook_secret: data.webhook_secret,
    pem: data.pem,
    installation_id: null,
    installations: [],
    created_at: new Date().toISOString(),
  };
  await saveApp(env.DB, app);
  return app;
}

export async function addInstallation(db: D1Database, inst: Installation) {
  const app = await loadApp(db);
  if (!app) return;
  app.installations = [...installsOf(app).filter((i) => i.id !== inst.id), inst];
  app.installation_id = null;
  await saveApp(db, app);
}

export async function removeInstallation(db: D1Database, id: number) {
  const app = await loadApp(db);
  if (!app) return;
  app.installations = installsOf(app).filter((i) => i.id !== id);
  app.installation_id = null;
  await saveApp(db, app);
}

/** After the install page sends you back: look the installation up and keep it. */
export async function recordInstallation(env: Env, id: number) {
  const app = await loadApp(env.DB);
  if (!app) return;
  const inst = await gh<{ id: number; account: { login: string } }>(`/app/installations/${id}`, `Bearer ${await appJwt(app)}`);
  await addInstallation(env.DB, { id: inst.id, account: inst.account.login });
}

/** Webhook secrets to try: the app's, and the per-repo one from PM_WEBHOOK_SECRET. */
export async function webhookSecrets(env: Env): Promise<string[]> {
  const app = await loadApp(env.DB);
  return [app?.webhook_secret, env.GITHUB_WEBHOOK_SECRET].filter((s): s is string => !!s);
}

// ---------- Acting as the app: list the repositories it is installed on ----------

const API = 'https://api.github.com';
const GH_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'MyPM', 'X-GitHub-Api-Version': '2022-11-28' };

function b64url(data: Uint8Array | string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  while (n > 0) {
    out.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | out.length, ...out];
}

/** GitHub hands out PKCS#1 ("RSA PRIVATE KEY"); WebCrypto wants PKCS#8. */
export function pemToPkcs8(pem: string): Uint8Array {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  if (!pem.includes('BEGIN RSA PRIVATE KEY')) return der;
  // PrivateKeyInfo ::= SEQUENCE { version 0, AlgorithmIdentifier rsaEncryption, OCTET STRING pkcs1 }
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLength(der.length)];
  const inner = [0x02, 0x01, 0x00, ...algo, ...octet];
  const total = inner.length + der.length;
  const out = new Uint8Array([0x30, ...derLength(total), ...inner, ...der]);
  return out;
}

/** A short-lived JWT that authenticates as the app itself. */
export async function appJwt(app: Pick<GithubApp, 'id' | 'pem'>): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(app.pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(app.id) }));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

async function gh<T>(path: string, auth: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, { ...init, headers: { ...GH_HEADERS, Authorization: auth } });
  if (!res.ok) throw new HttpError(502, `GitHub ${path.split('?')[0]}: ${res.status}`);
  return (await res.json()) as T;
}

export interface InstalledRepos {
  selection: 'all' | 'selected' | null;
  repos: { full_name: string; html_url: string; private: boolean }[];
}

/** Repositories the app can see across your installations, via installation tokens (cached in KV). */
export async function installedRepos(env: Env): Promise<InstalledRepos> {
  const app = await loadApp(env.DB);
  if (!app) return { selection: null, repos: [] };
  const jwt = `Bearer ${await appJwt(app)}`;
  let installs = installsOf(app);
  if (!installs.length && app.owner) {
    // Setup redirect or webhook missed: adopt the install on your own account.
    const list = await gh<{ id: number; account: { login: string } }[]>('/app/installations', jwt);
    const mine = list.find((i) => i.account.login.toLowerCase() === app.owner!.toLowerCase());
    if (!mine) return { selection: null, repos: [] };
    await addInstallation(env.DB, { id: mine.id, account: mine.account.login });
    installs = [{ id: mine.id, account: mine.account.login }];
  }
  if (!installs.length) return { selection: null, repos: [] };
  const repos: InstalledRepos['repos'] = [];
  let all = true;
  for (const { id } of installs) {
    const install = await gh<{ repository_selection: 'all' | 'selected' }>(`/app/installations/${id}`, jwt);
    if (install.repository_selection !== 'all') all = false;
    const cacheKey = `gh-inst-token:${id}`;
    let token = await env.OAUTH_KV.get(cacheKey);
    if (!token) {
      const t = await gh<{ token: string }>(`/app/installations/${id}/access_tokens`, jwt, { method: 'POST' });
      token = t.token;
      // Tokens live an hour; keep ours for 50 minutes.
      await env.OAUTH_KV.put(cacheKey, token, { expirationTtl: 3000 });
    }
    for (let page = 1; page <= 10; page++) {
      const r = await gh<{ total_count: number; repositories: { full_name: string; html_url: string; private: boolean }[] }>(
        `/installation/repositories?per_page=100&page=${page}`,
        `token ${token}`,
      );
      const before = repos.length;
      repos.push(...r.repositories.map(({ full_name, html_url, private: p }) => ({ full_name, html_url, private: p })));
      if (!r.repositories.length || repos.length - before < 100) break;
    }
  }
  repos.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return { selection: all ? 'all' : 'selected', repos };
}
