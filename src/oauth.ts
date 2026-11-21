import {
  AuthorizationError,
  CimdFetchError,
  OAuthProvider,
  type ConsentDescription,
  type OAuthHelpers,
} from '@cloudflare/workers-oauth-provider';
import { authenticate } from './auth';
import { handleMcp } from './mcp';
import { sha256Hex } from './service';
import { Env } from './types';

// OAuth for the MCP endpoint, so Claude can connect with a browser sign-in
// instead of a pasted token. This Worker is both the authorization server
// and the only resource (/mcp). Signing in is Cloudflare Access: /authorize
// sits behind Access, so reaching it already proves it is the owner; the page
// then only asks for consent. Static `pm_` API tokens keep working on /mcp
// through resolveExternalToken, for Claude Code cloud environments.

export const MCP_SCOPE = 'mcp';

type OAuthEnv = Env & { OAUTH_PROVIDER: OAuthHelpers };

let cached: { origin: string; provider: OAuthProvider<Env> } | null = null;

/** Built lazily because the public origin comes from env (localhost in dev). */
export function oauthProvider(env: Env, defaultHandler: ExportedHandler<Env>) {
  const origin = (env.PUBLIC_URL || 'https://pm.timothyxlu.xyz').replace(/\/$/, '');
  if (cached?.origin === origin) return cached.provider;
  const resource = `${origin}/mcp`;
  const provider = new OAuthProvider<Env>({
    apiRoute: '/mcp',
    apiHandler: {
      fetch: (request: Request, env: Env) => {
        // Stateless server: no standalone SSE stream and no sessions to end.
        if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
        return handleMcp(request, env);
      },
    },
    defaultHandler,
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/oauth/token',
    clientRegistrationEndpoint: '/oauth/register',
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: [MCP_SCOPE],
    requiredScopes: [MCP_SCOPE],
    resourceMetadata: { resource, authorization_servers: [origin] },
    accessTokenTTL: 3600,
    refreshTokenTTL: 90 * 86400,
    resolveExternalToken: async ({ token, env }) => {
      if (!token.startsWith('pm_')) return null;
      const row = await env.DB.prepare('SELECT id FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL')
        .bind(await sha256Hex(token))
        .first<{ id: string }>();
      if (!row) return null;
      await env.DB.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').bind(new Date().toISOString(), row.id).run();
      return { props: { via: 'api_token', tokenId: row.id }, audience: resource };
    },
  });
  cached = { origin, provider };
  return provider;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, status = 200, headers = new Headers()) {
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<style>
:root{--bg:#F6F6F4;--card:#fff;--ink:#1A1A1E;--muted:#5F5F66;--line:#E6E6E3;--accent:#4F46E5}
@media(prefers-color-scheme:dark){:root{--bg:#111113;--card:#1B1B1F;--ink:#EDEDF0;--muted:#A1A1AA;--line:#2C2C31;--accent:#818CF8}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,"PingFang SC","Noto Sans SC",system-ui,sans-serif}
main{max-width:420px;margin:12vh auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px}
h1{font-size:20px;margin:0 0 12px}p{margin:8px 0;color:var(--muted)}strong{color:var(--ink)}
.warn{color:#B45309}
.row{display:flex;gap:12px;margin-top:20px}
button{flex:1;height:48px;border-radius:12px;font:600 15px inherit;font-family:inherit;cursor:pointer}
.ok{background:var(--accent);color:#fff;border:0}.no{background:transparent;color:var(--ink);border:1px solid var(--line)}
</style></head><body><main><div class="card">${body}</div></main></body></html>`,
    { status, headers },
  );
}

function consentPage(d: ConsentDescription, handle: string) {
  const name = escape(d.clientName || '未命名应用');
  const origin = d.clientDomain
    ? `由 <strong>${escape(d.clientDomain)}</strong> 发布。`
    : '这个应用是自行注册的，名字未经验证。';
  return `<h1>允许 ${name} 访问 pm？</h1>
<p>${origin}</p>
<p>授权后它可以读取和修改你的项目与 issue，凭证会发送到 <strong>${escape(d.redirectHost)}</strong>。</p>
${d.redirectIsLoopback ? '<p class="warn">凭证会发给你电脑上的一个程序。只有在你刚刚从它发起登录时才继续。</p>' : ''}
<form method="post">
<input type="hidden" name="handle" value="${escape(handle)}">
<div class="row"><button class="no" name="decision" value="deny">拒绝</button><button class="ok" name="decision" value="approve">允许</button></div>
</form>`;
}

/** GET/POST /authorize. Reached only through Cloudflare Access (or dev bypass). */
export async function handleAuthorize(request: Request, env: OAuthEnv, ctx: ExecutionContext): Promise<Response> {
  const principal = await authenticate(request, env, ctx);
  if (!principal || principal.kind === 'token') {
    return page('需要登录', '<h1>需要登录</h1><p>请通过 Cloudflare Access 打开这个页面。</p>', 401);
  }
  const oauth = env.OAUTH_PROVIDER;
  try {
    if (request.method === 'GET') {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return page(`授权 ${details.clientName}`, consentPage(details, consent.handle), 200, consent.headers);
    }
    if (request.method === 'POST') {
      const form = await request.formData();
      const handle = String(form.get('handle') ?? '');
      if (form.get('decision') !== 'approve') {
        const denied = await oauth.denyConsent(request, handle);
        denied.headers.set('Location', denied.redirectTo);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await oauth.approveConsent(request, handle, { scope: [MCP_SCOPE] });
      const userId = principal.kind === 'access' ? (principal.email ?? 'owner') : 'owner';
      const { redirectTo } = await oauth.completeAuthorization({
        request: approved.request,
        userId,
        metadata: {},
        scope: approved.request.scope,
        props: { via: 'oauth', userId },
      });
      approved.headers.set('Location', redirectTo);
      return new Response(null, { status: 302, headers: approved.headers });
    }
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
      const message = error instanceof AuthorizationError ? error.description : '无法验证这个应用。';
      return page('授权失败', `<h1>授权失败</h1><p>${escape(message ?? '请求无效')}</p><p>请回到 Claude 重新发起连接。</p>`, 400);
    }
    throw error;
  }
}
