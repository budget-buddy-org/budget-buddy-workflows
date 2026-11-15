import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixture = resolve('tests/fixtures/node');
const script = resolve('scripts/commitlint.mjs');
test('real commitlint handles event policy and untrusted title text', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ci-policy-'));
  function run(command, args, options = {}) {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 15000, ...options });
    if (result.error) throw result.error;
    return result;
  }
  function git(...args) {
    const result = run('git', args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  function commit(message) {
    git('-c', 'user.name=CI Fixture', '-c', 'user.email=ci@example.com', 'commit', '--allow-empty', '-m', message);
    return git('rev-parse', 'HEAD');
  }
  function check(name, event, actor = 'fixture-user', expected = 0) {
    const path = join(cwd, 'event.json');
    writeFileSync(path, JSON.stringify(event));
    const result = run(process.execPath, [script], {
      cwd: fixture,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: name,
        GITHUB_ACTOR: actor,
        GITHUB_EVENT_PATH: path,
        GIT_DIR: join(cwd, '.git'),
        GIT_WORK_TREE: cwd,
      },
    });
    assert.equal(result.status === 0, expected === 0, result.stdout + result.stderr);
  }
  try {
    git('init', '-b', 'main');
    const base = commit('chore: initialize fixture');
    const good = commit('ci: valid consumer commit');
    const pr = { title: 'ci: share automation', base: { sha: base }, head: { sha: good, repo: { fork: true } } };
    check('pull_request', { pull_request: pr });
    check('pull_request', { pull_request: { ...pr, title: 'invalid title' } }, 'fixture-user', 1);
    const marker = join(cwd, 'injected');
    check('pull_request', { pull_request: { ...pr, title: `ci: $(touch ${marker})` } });
    assert.equal(existsSync(marker), false, 'PR text must never execute as shell code');
    check('push', { before: base, after: good });
    check('push', { before: '0'.repeat(40), after: good });
    check('push', { deleted: true });
    const bad = commit('invalid commit');
    check('pull_request', { pull_request: { ...pr, head: { sha: bad } } }, 'fixture-user', 1);
    check('push', { before: good, after: bad }, 'fixture-user', 1);
    check('pull_request', {}, 'dependabot[bot]');
    check('workflow_dispatch', {});
    check('pull_request_target', { pull_request: pr }, 'fixture-user', 1);
    check('push', { before: '--malicious', after: good }, 'fixture-user', 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
