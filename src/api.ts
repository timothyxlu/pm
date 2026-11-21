import { Hono } from 'hono';
import { z } from 'zod';
import { Principal } from './auth';
import * as svc from './service';
import { Actor, Env, HttpError, STATUSES } from './types';

type AppEnv = { Bindings: Env; Variables: { principal: Principal; actor: Actor } };

export const api = new Hono<AppEnv>();

async function body<T extends z.ZodTypeAny>(c: { req: { json: () => Promise<unknown> } }, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}

api.get('/health', (c) => c.json({ ok: true }));
api.get('/me', (c) => c.json({ principal: c.get('principal'), actor: c.get('actor') }));

// ----- projects -----
api.get('/projects', async (c) => c.json(await svc.listProjects(c.env.DB, c.req.query('archived') === '1')));
api.post('/projects', async (c) =>
  c.json(await svc.saveProject(c.env.DB, await body(c, svc.projectInput), c.get('actor')), 201),
);
api.get('/projects/:key', async (c) => c.json(await svc.getProject(c.env.DB, c.req.param('key'))));
api.patch('/projects/:key', async (c) => {
  const input = await body(c, svc.projectInput.omit({ key: true }));
  return c.json(await svc.saveProject(c.env.DB, { ...input, key: c.req.param('key') }, c.get('actor')));
});

// ----- issues -----
api.get('/issues', async (c) => {
  const q = c.req.query();
  const status = q.status
    ? q.status.split(',').filter((s): s is (typeof STATUSES)[number] => (STATUSES as readonly string[]).includes(s))
    : undefined;
  const input = svc.listIssuesInput.parse({
    project: q.project,
    status,
    label: q.label,
    priority: q.priority !== undefined ? Number(q.priority) : undefined,
    query: q.q,
    limit: q.limit ? Number(q.limit) : undefined,
    offset: q.offset ? Number(q.offset) : undefined,
  });
  return c.json(await svc.listIssues(c.env.DB, input));
});
api.post('/issues', async (c) => {
  const input = await body(c, svc.issueInput.omit({ identifier: true }));
  return c.json(await svc.saveIssue(c.env.DB, input, c.get('actor')), 201);
});
api.get('/issues/:identifier', async (c) => c.json(await svc.getIssue(c.env.DB, c.req.param('identifier'))));
api.patch('/issues/:identifier', async (c) => {
  const input = await body(c, svc.issueInput.omit({ identifier: true }));
  return c.json(await svc.saveIssue(c.env.DB, { ...input, identifier: c.req.param('identifier') }, c.get('actor')));
});
api.delete('/issues/:identifier', async (c) =>
  c.json(await svc.deleteIssue(c.env.DB, c.req.param('identifier'), c.get('actor'))),
);
api.post('/issues/:identifier/comments', async (c) => {
  const { body: text } = await body(c, z.object({ body: z.string() }));
  return c.json(await svc.addComment(c.env.DB, c.req.param('identifier'), text, c.get('actor')), 201);
});
api.post('/issues/:identifier/github', async (c) => {
  const { url } = await body(c, z.object({ url: z.string() }));
  return c.json(await svc.linkGithub(c.env.DB, c.req.param('identifier'), url, c.get('actor')), 201);
});

// ----- misc -----
api.get('/labels', async (c) => c.json(await svc.listLabels(c.env.DB)));
api.get('/summary', async (c) => c.json(await svc.weeklySummary(c.env.DB, Number(c.req.query('days') ?? 7))));
api.get('/sync', async (c) => c.json(await svc.sync(c.env.DB, c.req.query('since'))));

// ----- tokens: only from the browser (Access), never with a token -----
api.use('/tokens/*', async (c, next) => {
  if (c.get('principal').kind === 'token') throw new HttpError(403, 'Manage tokens from the web app');
  await next();
});
api.use('/tokens', async (c, next) => {
  if (c.get('principal').kind === 'token') throw new HttpError(403, 'Manage tokens from the web app');
  await next();
});
api.get('/tokens', async (c) => c.json(await svc.listTokens(c.env.DB)));
api.post('/tokens', async (c) => {
  const { name } = await body(c, z.object({ name: z.string().min(1) }));
  return c.json(await svc.createToken(c.env.DB, name), 201);
});
api.delete('/tokens/:id', async (c) => c.json(await svc.revokeToken(c.env.DB, c.req.param('id'))));
