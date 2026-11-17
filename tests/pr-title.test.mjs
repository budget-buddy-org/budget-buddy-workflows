import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('title validation needs no consumer checkout and treats untrusted text as data', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'pr-title-'));
  try {
    const event = join(cwd, 'event.json');
    for (const [title, expected] of [
      ['feat!: change API', 0], ['fix: correct rounding', 0], ['ci: refresh tooling', 0],
      ['chore(deps): bump package', 0], ['invalid title', 1],
      ['fix: $(touch injected)', 0], ['fix: first\nfeat: second', 1],
    ]) {
      writeFileSync(event, JSON.stringify({ pull_request: { title } }));
      const result = spawnSync(process.execPath, [resolve('release/pr-title.mjs')], {
        cwd, env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: event },
        encoding: 'utf8',
      });
      assert.equal(result.status === 0 ? 0 : 1, expected, result.stderr + result.stdout);
    }
  } finally { rmSync(cwd, { recursive: true }); }
});
