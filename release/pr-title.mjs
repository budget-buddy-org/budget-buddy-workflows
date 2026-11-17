import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
  throw new Error('PR title validation requires a pull_request event');
}
const title = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).pull_request?.title;
if (typeof title !== 'string' || !title.trim() || /[\r\n]/.test(title)) throw new Error('Invalid PR title');
const require = createRequire(import.meta.url);
const cli = require.resolve('@commitlint/cli/cli.js');
const result = spawnSync(process.execPath, [cli, '--config', fileURLToPath(new URL('./commitlint.config.cjs', import.meta.url)), '--verbose'], {
  input: title + '\n', stdio: ['pipe', 'inherit', 'inherit'],
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
