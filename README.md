# pm

Personal project tracker on Cloudflare: one Worker at `pm.timothyxlu.xyz` serving a REST API, an MCP server for Claude, and (phase 2) a Svelte PWA. Data lives in D1; the browser is protected by Cloudflare Access; Claude Code uses an API token.

## Layout

| Path | What |
| --- | --- |
| `src/worker.ts` | Entry: routing and auth for `/api/v1/*`, `/mcp`, `/webhooks/*` |
| `src/service.ts` | All business logic, shared by REST and MCP |
| `src/api.ts` | REST API (`/api/v1`) |
| `src/mcp.ts` | Stateless Streamable HTTP MCP server (`/mcp`) |
| `src/auth.ts` | Access JWT verification and Bearer tokens |
| `migrations/` | D1 schema (`wrangler d1 migrations`) |
| `public/` | Static assets (placeholder until the web app lands) |

## Local development

```sh
npm install
echo "DEV_AUTH_BYPASS=1" > .dev.vars      # local only: skips auth when no token is sent
npm run db:migrate:local
npm run dev                               # http://localhost:8787
npm run token:create -- local --local     # prints a token for the local DB
TOKEN=pm_... npm run smoke                # end-to-end checks of REST + MCP
```

## Deploy

Pushes to `main` run CI, apply D1 migrations and `wrangler deploy` (`.github/workflows/ci.yml`). The repo needs two Actions secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts edit, D1 edit, Workers Routes edit and DNS edit on the `timothyxlu.xyz` zone) and `CLOUDFLARE_ACCOUNT_ID`.

Cloudflare Access (Zero Trust → Access → Applications):

1. Self-hosted app for `pm.timothyxlu.xyz`, policy **Allow** your email, login method GitHub. Copy its AUD tag into `ACCESS_AUD` and your team domain into `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`.
2. A second app for `pm.timothyxlu.xyz/mcp` and `pm.timothyxlu.xyz/webhooks/*` with policy **Bypass**. The Worker checks tokens and webhook signatures itself.

## Using it from Claude Code

Create a token once (`npm run token:create -- "claude-code"`), export it as `PM_TOKEN`, and the committed `.mcp.json` connects Claude Code to `https://pm.timothyxlu.xyz/mcp`. In Claude Code cloud environments, add `PM_TOKEN` as an environment variable and allow `pm.timothyxlu.xyz` in the network settings. To use it from other repos, copy `.mcp.json` there or run:

```sh
claude mcp add --transport http pm https://pm.timothyxlu.xyz/mcp --header "Authorization: Bearer $PM_TOKEN"
```

MCP tools: `list_projects`, `get_project`, `save_project`, `list_issues`, `get_issue`, `save_issue`, `save_comment`, `link_github`, `weekly_summary`, `list_labels`.
