# pm

Personal project tracker on Cloudflare: one Worker at `pm.timothyxlu.xyz` serving a REST API, an MCP server for Claude, and a Svelte PWA. Data lives in D1; the browser is protected by Cloudflare Access. Claude connects to MCP with OAuth (sign in through Access in the browser) or, where no browser is available, with a static API token.

## Layout

| Path | What |
| --- | --- |
| `src/worker.ts` | Entry: routing and auth for `/api/v1/*`, `/mcp`, `/webhooks/*` |
| `src/service.ts` | All business logic, shared by REST and MCP |
| `src/api.ts` | REST API (`/api/v1`) |
| `src/mcp.ts` | Stateless Streamable HTTP MCP server (`/mcp`) |
| `src/auth.ts` | Access JWT verification and Bearer tokens |
| `src/oauth.ts` | OAuth 2.1 for MCP (`@cloudflare/workers-oauth-provider`): discovery, DCR/CIMD, consent page, tokens in KV |
| `migrations/` | D1 schema (`wrangler d1 migrations`) |
| `web/` | Svelte 5 PWA (Vite). Builds into `public/`, which the Worker serves |
| `web/src/lib/store.svelte.ts` | Local copy in IndexedDB, kept fresh with `/api/v1/sync` |
| `web/src/lib/i18n.svelte.ts` | Chinese and English UI strings (user content is never translated) |

## Local development

```sh
npm install
printf 'DEV_AUTH_BYPASS=1\nPUBLIC_URL=http://localhost:8787\nGITHUB_WEBHOOK_SECRET=smoke-secret\n' > .dev.vars   # local only
npm run db:migrate:local
npm run build                             # web app into public/
npm run dev                               # http://localhost:8787
npm run dev:web                           # optional: Vite with hot reload on :5173, API proxied to :8787
npm run token:create -- local --local     # prints a token for the local DB
TOKEN=pm_... npm run smoke                # end-to-end checks of REST + MCP
npm run smoke:oauth                       # end-to-end OAuth flow for MCP
```

## Web app

- Renders from IndexedDB at once, then pulls changes from `/api/v1/sync` (on load, when the tab becomes visible, and after each change). Search runs on the local copy.
- Works offline for reading: the service worker caches the app shell. Changes need a connection for now.
- When the Access session expires, a banner links to `/login`, which Access sends through sign-in and the Worker redirects back to `/`.
- Language follows the system and can be switched in Settings. Theme likewise.
- Two layouts from one codebase: below 960px wide it is the mobile PWA (bottom tabs, sheets); from 960px it switches to a desktop layout with a sidebar, dense one-line issue lists, a two-column issue page with a properties panel, a new-issue dialog and a ⌘K command palette (`web/src/lib/media.svelte.ts` holds the breakpoint).
- On phones, tap an issue's status icon in any list to change its status without opening it; sheets close with a downward drag; the new-issue page has a "create another" switch for entering several in a row.
- Keyboard: `⌘K` or `/` search and jump, `C` new issue, `J`/`K` move through lists, `Enter` open, `G` then `H`/`A`/`S` go to overview/active/settings; on an issue `S`/`P`/`L`/`D` set status/priority/labels/due date, `E` edits the title, `Esc` goes back; `?` lists them all.

## Deploy

Pushes to `main` run CI, apply D1 migrations and `wrangler deploy` (`.github/workflows/ci.yml`). The repo needs two Actions secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts edit, D1 edit, Workers Routes edit and DNS edit on the `timothyxlu.xyz` zone) and `CLOUDFLARE_ACCOUNT_ID`.

Cloudflare Access (Zero Trust → Access → Applications):

1. Self-hosted app for `pm.timothyxlu.xyz`, policy **Allow** your email, login method GitHub. Set its session duration to about a month. Copy its AUD tag into `ACCESS_AUD` and your team domain into `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`. This app also guards `/authorize`, the OAuth consent page, which is how MCP sign-in proves it is you.
2. A second app with policy **Bypass** for the machine endpoints, which the Worker authenticates itself: `pm.timothyxlu.xyz/mcp`, `pm.timothyxlu.xyz/oauth/*`, `pm.timothyxlu.xyz/.well-known/*`, `pm.timothyxlu.xyz/webhooks/*`.

## GitHub pull requests

Like Linear, a pull request moves the issues it refers to:

| PR event | Issue |
| --- | --- |
| opened, reopened, pushed to, or draft | Backlog / Todo → In progress |
| review requested | → In review |
| merged | → Done (closing references only) |
| closed without merging | unchanged; the link shows `closed` |

A PR refers to an issue when the identifier is in its **branch name** (`dev-123-fix-rss`, `claude/dev-123`), its **title** (`DEV-123 Fix RSS`), or its description after a closing word (`Fixes DEV-123`, also close/resolve/complete, and lists like `Fixes DEV-1, DEV-2`). These close the issue on merge. `Part of DEV-123` (also refs / related to / contributes to / towards) links the PR and starts the issue but never closes it. Bare mentions in the description are ignored. Statuses only move forward, so a done or canceled issue stays put, and redelivered events are harmless. Changes show as GitHub in the activity log, and the PR appears in the issue's GitHub section.

Setup, once: **Settings → Connections · GitHub → Connect GitHub.** This works like Linear's GitHub integration:

1. MyPM sends GitHub an app manifest (webhook URL `https://pm.timothyxlu.xyz/webhooks/github`, the Pull requests event, read-only Pull requests + Metadata permissions). You confirm the name on github.com and click Create.
2. GitHub sends the browser back to `/api/v1/integrations/github/callback`, which swaps the one-time code for the app's id, webhook secret and private key and stores them in D1 (`settings` table).
3. You land on the app's install page. Pick **All repositories** (new repos are then included automatically). GitHub returns to Settings, which shows the app as installed.

The callback and setup URLs are under `/api/v1`, behind Cloudflare Access like the rest of the app: GitHub only redirects your browser there, so no extra Bypass rule is needed. Webhook deliveries go to `/webhooks/*`, which is already in the Bypass app; the signature check is what keeps others out.

### Per-repo webhook (older setup, still works)

1. Make a random secret, e.g. `openssl rand -hex 32`.
2. Add it as the `PM_WEBHOOK_SECRET` repository secret of this repo (Settings → Secrets and variables → Actions). The next deploy stores it as the Worker secret `GITHUB_WEBHOOK_SECRET`. (Or run `npx wrangler secret put GITHUB_WEBHOOK_SECRET` yourself.)
3. In each repo: Settings → Webhooks → Add webhook. Payload URL `https://pm.timothyxlu.xyz/webhooks/github`, content type `application/json`, the same secret, "Let me select individual events" → **Pull requests** only.

`/webhooks/github` accepts a signature from either the app's secret or `GITHUB_WEBHOOK_SECRET`. With neither configured it answers 503. Once the app is installed on a repo, remove that repo's old webhook, or each PR event is processed twice (harmless, since statuses only move forward).

## Importing from Linear

Issues keep their Linear identifiers (e.g. `DEV-42`), timestamps, status, priority, labels, due dates, parent/child links and comments; new issues in the project continue after the highest imported number. Re-running is safe.

- Whole project: add a Linear personal API key as the `LINEAR_API_KEY` repository secret, then run the **Import from Linear** workflow from the Actions tab (dry run first). Locally: `LINEAR_API_KEY=... node scripts/import-linear.mjs --project "sigion.ai" --key DEV --remote`.
- A few issues: the `import_issues` MCP tool takes up to 50 issues per call.

Images uploaded to Linear stay on Linear's servers, so they need a Linear login to view.

## Using it from Claude Code

**Local (OAuth).** The committed `.mcp.json` points at `https://pm.timothyxlu.xyz/mcp`. In Claude Code run `/mcp`, pick `pm`, and authenticate: a browser opens, Cloudflare Access signs you in, you click Allow on the consent page, and Claude Code keeps the tokens (access 1 hour, refresh 90 days). For other repos: `claude mcp add --transport http pm https://pm.timothyxlu.xyz/mcp`.

**Cloud environments (no browser).** Create a token once (`npm run token:create -- "claude-cloud"`). In the environment settings, allow `pm.timothyxlu.xyz` under network access, and either add the token as a Network secret for that host (the proxy adds the `Authorization` header, so `.mcp.json` needs no change) or add it as `PM_TOKEN` and register the server in the setup script: `claude mcp add --transport http pm https://pm.timothyxlu.xyz/mcp --header "Authorization: Bearer $PM_TOKEN"`. `/mcp` accepts both OAuth tokens and `pm_` tokens.

MCP tools: `list_projects`, `get_project`, `save_project`, `list_issues`, `get_issue`, `save_issue`, `save_comment`, `link_github`, `weekly_summary`, `list_labels`.
