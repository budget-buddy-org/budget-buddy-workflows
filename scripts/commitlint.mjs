import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const eventName = process.env.GITHUB_EVENT_NAME;
if (process.env.GITHUB_ACTOR === 'dependabot[bot]' || eventName === 'workflow_dispatch') {
  console.log('No commit checks required for this event.');
  process.exit(0);
}
if (!['pull_request', 'push'].includes(eventName)) {
  throw new Error(`Unsupported commitlint event: ${eventName}`);
}
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
function lint(args, input) {
  const result = spawnSync('pnpm', ['exec', 'commitlint', ...args, '--verbose'], {
    input,
    stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function sha(value) {
  if (!/^[a-f0-9]{40}$/.test(value ?? '')) throw new Error('Invalid commit SHA');
  return value;
}
if (eventName === 'pull_request') {
  const pr = event.pull_request;
  if (typeof pr?.title !== 'string') throw new Error('Missing PR title');
  lint([], `${pr.title}\n`);
  lint(['--from', sha(pr.base.sha), '--to', sha(pr.head.sha)]);
} else if (!event.deleted) {
  const before = sha(event.before);
  const after = sha(event.after);
  lint(before === '0'.repeat(40) ? ['--to', after] : ['--from', before, '--to', after]);
}
