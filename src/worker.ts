import { Hono } from 'hono';
import { api } from './api';
import { authenticate, Principal } from './auth';
import { handleMcp } from './mcp';
import { Actor, Env, HttpError } from './types';

type AppEnv = { Bindings: Env; Variables: { principal: Principal; actor: Actor } };

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

app.all('/mcp', async (c) => {
  const principal = await authenticate(c.req.raw, c.env, c.executionCtx as ExecutionContext);
  if (!principal) {
    return c.json({ error: 'Unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer realm="pm"' });
  }
  return handleMcp(c.req.raw, c.env);
});

// GitHub webhooks arrive in phase 3.
app.post('/webhooks/github', (c) => c.json({ error: 'Not implemented yet' }, 501));

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

export default app satisfies ExportedHandler<Env>;
