// Create an API token for Claude Code / scripts and store only its hash in D1.
// Usage: npm run token:create -- "claude-code laptop" [--local]
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const local = args.includes('--local');
const name = args.find((a) => !a.startsWith('--')) ?? 'claude-code';
const token = 'pm_' + randomBytes(24).toString('base64url');
const hash = createHash('sha256').update(token).digest('hex');
const sql = `INSERT INTO api_tokens (id, name, token_hash, created_at) VALUES ('${randomUUID()}', '${name.replace(/'/g, "''")}', '${hash}', '${new Date().toISOString()}')`;
execFileSync('npx', ['wrangler', 'd1', 'execute', 'pm', local ? '--local' : '--remote', '--command', sql], { stdio: 'inherit' });
console.log(`\nToken "${name}" created. It is shown only once:\n\n  ${token}\n`);
