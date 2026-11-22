import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import * as svc from './service';
import { Env, HttpError } from './types';

// Stateless Streamable HTTP MCP server: a fresh server per request, JSON
// responses, no sessions. Tool names follow the Linear connector's
// conventions (list_*, get_*, save_* where save creates or updates).

const ACTOR = 'claude' as const;

function result(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function wrap<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return result(await fn(args));
    } catch (e) {
      const msg = e instanceof HttpError || e instanceof Error ? e.message : String(e);
      return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
    }
  };
}

function buildServer(env: Env) {
  const db = env.DB;
  const server = new McpServer(
    { name: 'pm', version: '0.1.0' },
    {
      instructions:
        'Personal project tracker at pm.timothyxlu.xyz. Issues are identified like BLOG-12 (issues migrated from Linear keep ids like ENG-42). ' +
        'Statuses: backlog, todo, in_progress, in_review, done, canceled. Priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low. ' +
        'Include the issue identifier in branch names and PR titles (e.g. blog-12-fix-rss), or write "Fixes BLOG-12" in the PR description: opening the PR moves the issue to in_progress and merging it moves it to done. Use "Part of BLOG-12" for a PR that should not close the issue.',
    },
  );

  server.registerTool(
    'list_projects',
    {
      description: 'List projects with issue counts per status and progress (share of non-canceled issues that are done).',
      inputSchema: { include_archived: z.boolean().optional() },
      annotations: { readOnlyHint: true },
    },
    wrap(async ({ include_archived }) => svc.listProjects(db, include_archived ?? false)),
  );

  server.registerTool(
    'get_project',
    {
      description: 'Get one project by key, with its open issues.',
      inputSchema: { key: z.string() },
      annotations: { readOnlyHint: true },
    },
    wrap(async ({ key }) => svc.getProject(db, key)),
  );

  server.registerTool(
    'save_project',
    {
      description: 'Create a project (when the key is new) or update it. name is required when creating.',
      inputSchema: svc.projectInput.shape,
    },
    wrap(async (args) => svc.saveProject(db, args, ACTOR)),
  );

  server.registerTool(
    'list_issues',
    {
      description:
        'List issues. Without status it returns open issues only (not done/canceled); with query it searches all statuses. Paginate with offset.',
      inputSchema: svc.listIssuesInput.shape,
      annotations: { readOnlyHint: true },
    },
    wrap(async (args) => svc.listIssues(db, args)),
  );

  server.registerTool(
    'get_issue',
    {
      description: 'Get an issue with description, labels, comments, GitHub links, sub-issues and recent activity.',
      inputSchema: { identifier: z.string().describe('e.g. BLOG-12') },
      annotations: { readOnlyHint: true },
    },
    wrap(async ({ identifier }) => svc.getIssue(db, identifier)),
  );

  server.registerTool(
    'save_issue',
    {
      description:
        'Create an issue (omit identifier; project and title required) or update one (pass identifier and only the fields to change).',
      inputSchema: svc.issueInput.shape,
    },
    wrap(async (args) => svc.saveIssue(db, args, ACTOR)),
  );

  server.registerTool(
    'save_comment',
    {
      description: 'Add a Markdown comment to an issue.',
      inputSchema: { identifier: z.string(), body: z.string() },
    },
    wrap(async ({ identifier, body }) => svc.addComment(db, identifier, body, ACTOR)),
  );

  server.registerTool(
    'import_issues',
    {
      description:
        'Bulk import issues (up to 50 per call) into an existing project, keeping their original identifiers (e.g. ENG-42), ' +
        'created/completed timestamps and comments. Idempotent: re-importing updates rows in place. Issues whose parent ' +
        'is not imported yet are listed in unresolved_parents; import them again after the parent exists.',
      inputSchema: svc.importIssuesInput.shape,
    },
    wrap(async (args) => svc.importIssues(db, args, ACTOR)),
  );

  server.registerTool(
    'link_github',
    {
      description: 'Link a GitHub pull request or issue URL to an issue.',
      inputSchema: {
        identifier: z.string(),
        url: z.string().describe('https://github.com/owner/repo/pull/123 or .../issues/45'),
        title: z.string().optional(),
        state: z.enum(['open', 'draft', 'merged', 'closed']).optional(),
      },
    },
    wrap(async ({ identifier, url, title, state }) => svc.linkGithub(db, identifier, url, ACTOR, { title, state })),
  );

  server.registerTool(
    'weekly_summary',
    {
      description: 'What was completed, created, and is still in progress over the last N days (default 7).',
      inputSchema: { days: z.number().int().min(1).max(90).optional() },
      annotations: { readOnlyHint: true },
    },
    wrap(async ({ days }) => svc.weeklySummary(db, days ?? 7)),
  );

  server.registerTool(
    'list_labels',
    { description: 'List all labels.', inputSchema: {}, annotations: { readOnlyHint: true } },
    wrap(async () => svc.listLabels(db)),
  );

  return server;
}

export async function handleMcp(req: Request, env: Env): Promise<Response> {
  if (req.method === 'GET' || req.method === 'DELETE') {
    // Stateless server: no standalone SSE stream and no sessions to end.
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }
  const server = buildServer(env);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}
