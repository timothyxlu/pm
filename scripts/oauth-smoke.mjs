// End-to-end check of the MCP OAuth flow against a dev server with DEV_AUTH_BYPASS=1.
// Usage: BASE=http://localhost:8787 node scripts/oauth-smoke.mjs
import { createHash, randomBytes } from 'node:crypto';

const BASE = process.env.BASE ?? 'http://localhost:8787';
const REDIRECT = 'http://localhost:9999/callback';
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exit(1);
};
const mcpInit = (token) =>
  fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'oauth-smoke', version: '0' } },
    }),
  });

// 1. Unauthenticated MCP request is challenged with resource metadata.
const unauth = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
if (unauth.status !== 401) fail(`unauthenticated /mcp returned ${unauth.status}`);
const challenge = unauth.headers.get('WWW-Authenticate') ?? '';
if (!challenge.includes('resource_metadata')) fail(`challenge lacks resource_metadata: ${challenge}`);

// 2. Discovery documents.
const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`)).json();
if (prm.resource !== `${BASE}/mcp`) fail(`protected resource metadata: ${JSON.stringify(prm)}`);
const asm = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
if (!asm.authorization_endpoint?.endsWith('/authorize')) fail(`AS metadata: ${JSON.stringify(asm)}`);

// 3. Dynamic client registration.
const reg = await (
  await fetch(asm.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'Smoke Test', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' }),
  })
).json();
if (!reg.client_id) fail(`registration: ${JSON.stringify(reg)}`);

// 4. Authorize with PKCE: consent page, then approve.
const verifier = randomBytes(32).toString('base64url');
const challengeS256 = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(8).toString('hex');
const authUrl = new URL(asm.authorization_endpoint);
Object.entries({
  response_type: 'code',
  client_id: reg.client_id,
  redirect_uri: REDIRECT,
  scope: 'mcp',
  state,
  code_challenge: challengeS256,
  code_challenge_method: 'S256',
  resource: `${BASE}/mcp`,
}).forEach(([k, v]) => authUrl.searchParams.set(k, v));
const consent = await fetch(authUrl, { redirect: 'manual' });
const html = await consent.text();
if (consent.status !== 200 || !html.includes('Smoke Test')) fail(`consent page ${consent.status}: ${html.slice(0, 300)}`);
const handle = /name="handle" value="([^"]+)"/.exec(html)?.[1];
if (!handle) fail('no consent handle');
const cookies = consent.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const approve = await fetch(authUrl, {
  method: 'POST',
  redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies, Origin: BASE },
  body: new URLSearchParams({ handle, decision: 'approve' }),
});
const location = approve.headers.get('Location');
if (approve.status !== 302 || !location?.startsWith(REDIRECT)) fail(`approve ${approve.status}: ${await approve.text()}`);
const cb = new URL(location);
if (cb.searchParams.get('state') !== state) fail('state mismatch');
const code = cb.searchParams.get('code');
if (!code) fail(`no code in ${location}`);

// 5. Token exchange.
const tokenRes = await fetch(asm.token_endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT,
    client_id: reg.client_id,
    code_verifier: verifier,
    resource: `${BASE}/mcp`,
  }),
});
const tokens = await tokenRes.json();
if (!tokens.access_token || !tokens.refresh_token) fail(`token: ${JSON.stringify(tokens)}`);

// 6. The OAuth access token works on /mcp; so does a refresh.
const ok = await mcpInit(tokens.access_token);
const body = await ok.json();
if (ok.status !== 200 || body.result?.serverInfo?.name !== 'pm') fail(`mcp with oauth token: ${ok.status} ${JSON.stringify(body)}`);
const refreshed = await (
  await fetch(asm.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: reg.client_id }),
  })
).json();
if (!refreshed.access_token) fail(`refresh: ${JSON.stringify(refreshed)}`);
if ((await mcpInit('not-a-real-token')).status !== 401) fail('bogus token should be 401');

console.log('OK: OAuth flow (discovery, DCR, consent, PKCE, token, refresh, MCP) passed');
