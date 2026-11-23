import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkConsumer, updateConsumer } from '../scripts/consumer-policy.mjs';
import { selectValidatedRevision } from '../scripts/rollout-consumers.mjs';
const sha = 'a'.repeat(40), next = 'b'.repeat(40);
const versions = { node: '26.13.1', pnpm: '12.21.0' };
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ci-policy-'));
  mkdirSync(join(root, '.github/workflows'), { recursive: true });
  writeFileSync(join(root, '.github/workflows/ci.yml'), `jobs:\n  ci:\n    uses: budget-buddy-org/budget-buddy-workflows/.github/workflows/web-ci.yml@${sha}\n`);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@12.21.0', scripts: { test: 'do-not-change' } }, null, 2));
  writeFileSync(join(root, 'pnpm-lock.yaml'), '    packageManagerDependencies:\n      pnpm:\n        specifier: 12.21.0\n        version: 12.21.0\n');
  writeFileSync(join(root, 'Dockerfile'), 'ARG NODE_VERSION=26.13.1\nFROM node:${NODE_VERSION}-alpine\n');
  return root;
}
test('consistency rejects mixed refs, floating refs and mismatched runtime metadata', () => {
  const root = fixture();
  try {
    assert.equal(checkConsumer(root, sha, versions).references, 1);
    for (const ref of [next, 'main']) {
      writeFileSync(join(root, '.github/workflows/other.yml'), `uses: budget-buddy-org/budget-buddy-workflows/.github/actions/setup-node@${ref}\n`);
      assert.throws(() => checkConsumer(root, sha, versions), /same library/);
    }
    rmSync(join(root, '.github/workflows/other.yml'));
    assert.throws(() => checkConsumer(root, sha, { ...versions, pnpm: '12.22.0' }), /packageManager/);
    assert.throws(() => checkConsumer(root, sha, { ...versions, node: '27.0.0' }), /Docker/);
    writeFileSync(join(root, 'pnpm-lock.yaml'), '');
    assert.throws(() => checkConsumer(root, sha, versions), /lockfile/);
  } finally { rmSync(root, { recursive: true }); }
});
test('consumer policy rejects references to the retired repository name', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, '.github/workflows/ci.yml'), `uses: budget-buddy-org/ci-workflows/.github/workflows/web-ci.yml@${sha}\n`);
    assert.throws(() => checkConsumer(root, sha, versions), /Every shared action\/workflow/);
  } finally { rmSync(root, { recursive: true }); }
});
test('coordinated edits preserve app scripts and require lock refresh only on pnpm changes', () => {
  const root = fixture();
  try {
    assert.equal(updateConsumer(root, next, versions), false);
    assert.equal(checkConsumer(root, next, versions).revision, next);
    assert.equal(updateConsumer(root, next, { node: '27.0.0', pnpm: '12.22.0' }), true);
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'))).scripts.test, 'do-not-change');
    assert.match(readFileSync(join(root, 'Dockerfile'), 'utf8'), /NODE_VERSION=27.0.0/);
    assert.throws(() => updateConsumer(root, 'main', versions));
  } finally { rmSync(root, { recursive: true }); }
});
test('rollouts require successful push validation of current main, never PR or stale runs', () => {
  const good = { head_sha: sha, head_branch: 'main', event: 'push', conclusion: 'success' };
  assert.equal(selectValidatedRevision(sha, [good]), sha);
  for (const change of [{ head_sha: next }, { head_branch: 'feature' }, { event: 'pull_request' }, { conclusion: 'failure' }]) {
    assert.throws(() => selectValidatedRevision(sha, [{ ...good, ...change }]));
  }
});

test('Gradle consumers can remove Node tooling without breaking coordinated updates', () => {
  const root = fixture();
  try {
    rmSync(join(root, 'package.json'));
    rmSync(join(root, 'pnpm-lock.yaml'));
    rmSync(join(root, 'Dockerfile'));
    assert.throws(() => checkConsumer(root, sha, versions), /Only Gradle/);
    writeFileSync(join(root, 'build.gradle.kts'), '');
    assert.equal(updateConsumer(root, next, versions), false);
    assert.equal(checkConsumer(root, next, versions).revision, next);
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'stale');
    assert.throws(() => checkConsumer(root, next, versions), /obsolete lockfile/);
  } finally { rmSync(root, { recursive: true }); }
});

test('verification records keep literal library pins in dated historical sections', () => {
  const document = readFileSync(new URL('../docs/verification.md', import.meta.url), 'utf8');
  assert.ok(document.includes('/actions/workflows/audit-consumers.yml'));
  let historical = false;
  for (const line of document.split('\n')) {
    if (/^#{1,2} /.test(line)) historical = /^## Historical verification — \d{4}-\d{2}-\d{2}$/.test(line);
    if (!historical) assert.doesNotMatch(line, /\b[0-9a-f]{40}\b/i, 'Put immutable pins in dated Historical sections');
  }
});
