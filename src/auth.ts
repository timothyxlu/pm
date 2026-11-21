import { Env } from './types';
import { sha256Hex } from './service';

// Three ways in:
//  1. Browser behind Cloudflare Access: verify the Access JWT, from the
//     Cf-Access-Jwt-Assertion header or the CF_Authorization cookie.
//  2. Claude Code and scripts: `Authorization: Bearer pm_...` checked against api_tokens.
//  3. Local dev: DEV_AUTH_BYPASS=1 in .dev.vars.

export type Principal = { kind: 'access'; email?: string } | { kind: 'token'; tokenId: string } | { kind: 'dev' };

export async function authenticate(req: Request, env: Env, ctx: ExecutionContext): Promise<Principal | null> {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return verifyBearer(auth.slice(7).trim(), env, ctx);
  }
  const jwt = req.headers.get('Cf-Access-Jwt-Assertion') ?? readCookie(req, 'CF_Authorization');
  if (jwt) {
    const claims = await verifyAccessJwt(jwt, env);
    if (claims) return { kind: 'access', email: claims.email as string | undefined };
  }
  if (env.DEV_AUTH_BYPASS === '1') return { kind: 'dev' };
  return null;
}

async function verifyBearer(token: string, env: Env, ctx: ExecutionContext): Promise<Principal | null> {
  if (!token.startsWith('pm_')) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare('SELECT id FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(hash)
    .first<{ id: string }>();
  if (!row) return null;
  ctx.waitUntil(
    env.DB.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').bind(new Date().toISOString(), row.id).run(),
  );
  return { kind: 'token', tokenId: row.id };
}

function readCookie(req: Request, name: string) {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

// ---------- Cloudflare Access JWT (RS256) ----------

let jwksCache: { keys: Map<string, CryptoKey>; fetchedAt: number } | null = null;

async function accessKeys(teamDomain: string, forceRefresh = false) {
  if (!forceRefresh && jwksCache && Date.now() - jwksCache.fetchedAt < 3600_000) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Failed to fetch Access certs: ${res.status}`);
  const { keys } = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
  const map = new Map<string, CryptoKey>();
  for (const jwk of keys) {
    map.set(
      jwk.kid,
      await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']),
    );
  }
  jwksCache = { keys: map, fetchedAt: Date.now() };
  return map;
}

function b64urlDecode(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function verifyAccessJwt(jwt: string, env: Env): Promise<Record<string, unknown> | null> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    if (header.alg !== 'RS256') return null;
    let keys = await accessKeys(env.ACCESS_TEAM_DOMAIN);
    if (!keys.has(header.kid)) keys = await accessKeys(env.ACCESS_TEAM_DOMAIN, true);
    const key = keys.get(header.kid);
    if (!key) return null;
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlDecode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return null;
    if (payload.iss && payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
    return payload;
  } catch {
    return null;
  }
}
