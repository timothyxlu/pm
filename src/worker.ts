import { Hono } from 'hono';
import { api } from './api';
import { authenticate, Principal } from './auth';
import { handleAuthorize, oauthProvider } from './oauth';
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

// GitHub webhooks arrive in phase 3.
app.post('/webhooks/github', (c) => c.json({ error: 'Not implemented yet' }, 501));

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

const defaultHandler: ExportedHandler<Env> = { fetch: (req, env, ctx) => app.fetch(req, env, ctx) };

export default {
  fetch(request, env, ctx) {
    return oauthProvider(env, defaultHandler).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
