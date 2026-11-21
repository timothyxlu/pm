// Create an API token for Claude Code / scripts and store only its hash in D1.
// Usage: npm run token:create -- "claude-code laptop" [--local]
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const local = args.includes('--local');
const name = args.find((a) => !a.startsWith('--')) ?? 'claude-code';
const token = 'pm_' + randomBytes(24).toString('base64url');
const hash = createHash('sha256').update(token).digest('hex');
const sql = `INSERT INTO api_tokens (id, name, token_hash, created_at) VALUES ('${randomUUID()}', '${name.replace(/'/g, "''")}', '${hash}', '${new Date().toISOString()}')`;
if (local) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'pm', '--local', '--command', sql], { stdio: 'inherit' });
} else {
  // wrangler.jsonc holds placeholder IDs (CI fills them in), so look the
  // database up by name in your account and point a temporary config at it.
  const info = JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'info', 'pm', '--json'], { encoding: 'utf8' }));
  const id = info.uuid ?? info.database_id;
  if (!id) throw new Error('Could not find the D1 database "pm" in your Cloudflare account');
  const config = '.wrangler-token.json';
  writeFileSync(config, JSON.stringify({ name: 'pm', d1_databases: [{ binding: 'DB', database_name: 'pm', database_id: id }] }));
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'pm', '--remote', '-c', config, '--command', sql], { stdio: 'inherit' });
  } finally {
    rmSync(config, { force: true });
  }
}
console.log(`\nToken "${name}" created. It is shown only once:\n\n  ${token}\n`);
