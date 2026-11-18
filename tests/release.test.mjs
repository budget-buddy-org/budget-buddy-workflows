import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration } from '../release/run.mjs';
import { isAbsolute } from 'node:path';

test('managed profiles resolve plugins from the locked tooling installation', async () => {
  for (const profile of ['gradle-app', 'web-app', 'contracts']) {
    const config = await configuration(profile);
    assert.deepEqual(config.branches, ['main']);
    for (const [plugin] of config.plugins) assert.ok(isAbsolute(plugin));
    const notes = config.plugins.find(([plugin]) => plugin.includes('release-notes-generator'))[1];
    const preset = await import(notes.config);
    assert.equal(typeof preset.default, 'function');
  }
  await assert.rejects(configuration('../arbitrary'), /Unknown release profile/);
});

test('contracts preserve generated Swift and spec changes in the release commit', async () => {
  const config = await configuration('contracts');
  const git = config.plugins.find(([plugin]) => /@semantic-release\/git\//.test(plugin))[1];
  assert.ok(git.assets.includes('Sources/BudgetBuddyContracts/'));
  assert.ok(git.assets.includes('specs/openapi.yaml'));
  const exec = config.plugins.find(([plugin]) => /@semantic-release\/exec\//.test(plugin))[1];
  assert.match(exec.prepareCmd, /pnpm run generate:swift/);
});

test('release analysis works without consumer dependencies and preserves version decisions', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const cwd = mkdtempSync(join(tmpdir(), 'managed-release-'));
  try {
    for (const profile of ['gradle-app', 'web-app', 'contracts']) {
      const config = await configuration(profile);
      const [module, options] = config.plugins.find(([path]) => path.includes('commit-analyzer'));
      const { analyzeCommits } = await import(module);
      for (const [message, expected] of [
        ['fix: correct rounding', 'patch'],
        ['feat: add budgets', 'minor'],
        ['feat!: change transaction format', 'major'],
        ['docs: explain budgets', null],
        ['chore: refresh tooling', null],
      ]) {
        const result = await analyzeCommits(options, {
          cwd, commits: [{ hash: 'a'.repeat(40), message }], logger: { log() {} },
        });
        assert.equal(result, expected, profile + ': ' + message);
      }
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('each managed profile renders real release notes with its installed writer and preset', async () => {
  for (const profile of ['gradle-app', 'web-app', 'contracts']) {
    const config = await configuration(profile);
    const [module, options] = config.plugins.find(([path]) => path.includes('release-notes-generator'));
    const { generateNotes } = await import(module);
    const notes = await generateNotes(options, {
      cwd: process.cwd(),
      options: { repositoryUrl: 'https://github.com/budget-buddy-org/example.git' },
      commits: [{ hash: 'a'.repeat(40), message: 'fix: correct rounding' }],
      lastRelease: { version: '1.2.3', gitTag: 'v1.2.3', gitHead: 'b'.repeat(40) },
      nextRelease: { version: '1.2.4', gitTag: 'v1.2.4', gitHead: 'c'.repeat(40) },
      logger: { log() {} },
    });
    assert.match(notes, /correct rounding/);
    assert.match(notes, /1\.2\.4/);
    assert.match(notes, /Bug Fixes/);
  }
});
