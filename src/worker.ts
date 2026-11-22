import { Hono } from 'hono';
import { api } from './api';
import { authenticate, Principal } from './auth';
import { PullRequestEvent, verifySignature } from './github';
import { handleAuthorize, oauthProvider } from './oauth';
import { applyPullRequest } from './service';
import { Actor, Env, HttpError } from './types';

type AppEnv = { Bindings: Env; Variables: { principal: Principal; actor: Actor } };

// Everything except /mcp and the OAuth endpoints (which OAuthProvider owns)
// lands here.
const app = new Hono<AppEnv>();

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
  console.error(err);
  return c.json({ error: 'Internal error' }, 500);
});

// Every dynamic route needs a principal. Static assets are served before the
// Worker runs and are protected by Cloudflare Access at the edge.
app.use('/api/*', async (c, next) => {
  const principal = await authenticate(c.req.raw, c.env, c.executionCtx as ExecutionContext);
  if (!principal) return c.json({ error: 'Unauthorized' }, 401);
  c.set('principal', principal);
  // Changes made with an API token are attributed to Claude; browser changes to you.
  c.set('actor', principal.kind === 'token' ? 'claude' : 'me');
  await next();
});

app.route('/api/v1', api);

// OAuth consent page for MCP clients (behind Cloudflare Access).
app.all('/authorize', (c) =>
  handleAuthorize(c.req.raw, c.env as Parameters<typeof handleAuthorize>[1], c.executionCtx as ExecutionContext),
);

// The PWA's service worker serves the app shell offline, so Cloudflare Access
// never sees a page load. When the session expires the app navigates here:
// Access sends the browser to sign in, then this sends it back to the app.
app.get('/login', (c) => c.redirect('/', 302));

// GitHub webhooks (repo or GitHub App webhook, content type application/json,
// "Pull requests" events). Cloudflare Access bypasses /webhooks/*, so the
// shared secret is the only thing that proves a request came from GitHub.
app.post('/webhooks/github', async (c) => {
  const secret = c.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: 'GITHUB_WEBHOOK_SECRET is not set' }, 503);
  const raw = await c.req.text();
  if (!(await verifySignature(secret, raw, c.req.header('X-Hub-Signature-256') ?? null))) {
    return c.json({ error: 'Bad signature' }, 401);
  }
  const event = c.req.header('X-GitHub-Event');
  if (event === 'ping') return c.json({ ok: true, pong: true });
  if (event !== 'pull_request') return c.json({ ok: true, ignored: event ?? null });
  let payload: PullRequestEvent;
  try {
    payload = JSON.parse(raw);
  } catch {
    return c.json({ error: 'Expected a JSON body (set the webhook content type to application/json)' }, 400);
  }
  if (!payload?.pull_request || !payload.repository) return c.json({ error: 'Not a pull_request payload' }, 400);
  return c.json({ ok: true, ...(await applyPullRequest(c.env.DB, payload)) });
});

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

const defaultHandler: ExportedHandler<Env> = { fetch: (req, env, ctx) => app.fetch(req, env, ctx) };

export default {
  fetch(request, env, ctx) {
    return oauthProvider(env, defaultHandler).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
