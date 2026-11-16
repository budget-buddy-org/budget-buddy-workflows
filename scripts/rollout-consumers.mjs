import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumers, library, checkConsumer, updateConsumer } from './consumer-policy.mjs';

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
export function selectValidatedRevision(head, runs) {
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('Invalid main revision');
  const run = runs.find(run => run.head_sha === head && run.head_branch === 'main' && run.event === 'push' && run.conclusion === 'success');
  if (!run) throw new Error('Current library main has not passed validation; retry after its checks complete');
  return head;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === 'select') {
    const head = JSON.parse(gh('api', `repos/${library}/commits/main`)).sha;
    const runs = JSON.parse(gh('api', `repos/${library}/actions/workflows/validate.yml/runs?branch=main&event=push&per_page=30`)).workflow_runs;
    const sha = selectValidatedRevision(head, runs);
    appendFileSync(process.env.GITHUB_OUTPUT, `revision=${sha}\nconsumers=${JSON.stringify(consumers)}\n`);
    console.log(`Validated rollout target: ${sha}`);
  } else if (mode === 'update') {
    const name = process.env.CONSUMER;
    if (!consumers.includes(name)) throw new Error('Unknown consumer');
    const root = resolve('consumer');
    const revision = process.env.LIBRARY_REVISION;
    const versions = JSON.parse(readFileSync(new URL('../runtime-versions.json', import.meta.url), 'utf8'));
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const branch = 'codex/update-shared-ci';
    git('switch', '-c', branch);
    const managerChanged = updateConsumer(root, revision, versions);
    if (managerChanged) {
      execFileSync('pnpm', ['install', '--lockfile-only', '--no-frozen-lockfile', '--ignore-scripts', '--ignore-pnpmfile'], { cwd: root, stdio: 'inherit' });
    }
    console.log(JSON.stringify(checkConsumer(root, revision, versions)));
    const changed = git('status', '--porcelain');
    if (!changed) { console.log(`${name} is aligned`); process.exit(0); }
    const fullName = `budget-buddy-org/${name}`;
    const existing = JSON.parse(gh('pr', 'list', '--repo', fullName, '--head', branch, '--state', 'open', '--json', 'number'));
    // Never overwrite human edits or a rollout still under review.
    if (existing.length) { console.log(`Pending rollout: ${fullName}#${existing[0].number}; finish it before advancing`); process.exit(0); }
    git('config', 'user.name', 'github-actions[bot]');
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    git('add', '.github/workflows', 'package.json', 'pnpm-lock.yaml');
    if (name === 'budget-buddy-web-app') git('add', 'Dockerfile');
    git('commit', '-m', 'ci: align shared workflows and runtime metadata');
    const previous = git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`).split(/\s/)[0];
    git('push', `--force-with-lease=refs/heads/${branch}:${previous}`, 'origin', branch);
    const body = resolve('rollout-pr.md');
    writeFileSync(body, `Adopt validated shared CI commit ${revision} in all workflow/action references, with Node ${versions.node} and pnpm ${versions.pnpm}. Refresh package-manager lock metadata when needed.\n\nThis is one coordinated rollout across contracts, API and web. Required consumer CI/policy checks and automatic image checks must pass before merge.\n\nLibrary: https://github.com/${library}/commit/${revision}\n`);
    gh('pr', 'create', '--repo', fullName, '--base', 'main', '--head', branch, '--title', 'ci: align shared workflows and runtime metadata', '--body-file', body);
  } else throw new Error('Unknown rollout operation');
}
