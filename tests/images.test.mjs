import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecords, blockingFindings, validateIndex, versionFrom, immutableImage, promotionTags } from '../scripts/images.mjs';
import { signingIdentity } from '../scripts/signing-identity.mjs';

const repo = 'budget-buddy-org/budget-buddy-web-app';
const sha = 'a'.repeat(40), digest = 'sha256:' + 'b'.repeat(64);
const record = { image: 'ghcr.io/' + repo, version: '1.2.3', sourceSha: sha, platform: 'linux/amd64', digest };
test('digest handoff rejects mixed commits, versions, repositories, and duplicate platforms', () => {
  const records = [record, { ...record, platform: 'linux/arm64' }];
  assert.equal(validateRecords(records, repo, '1.2.3', sha).length, 2);
  for (const change of [{ sourceSha: 'c'.repeat(40) }, { version: '1.2.4' }, { image: 'ghcr.io/other/repo' }, { platform: 'linux/amd64' }, { digest: 'latest' }]) {
    assert.throws(() => validateRecords([record, { ...records[1], ...change }], repo, '1.2.3', sha));
  }
  assert.throws(() => validateRecords([record], repo, '1.2.3', sha));
  assert.equal(validateRecords([record], repo, '1.2.3', sha, 'linux/amd64').length, 1);
  assert.equal(versionFrom('version=1.2.3\n', 'gradle.properties'), '1.2.3');
  assert.throws(() => versionFrom('{"version":"1.2.3; echo unsafe"}', 'package.json'));
  assert.equal(immutableImage(record.image + '@' + digest), record.image + '@' + digest);
  assert.throws(() => immutableImage(record.image + ':latest'));
});
test('existing vulnerability gates are preserved, with unfixed CVEs and secrets handled correctly', () => {
  const report = severity => ({ SchemaVersion: 2, Results: [{ Vulnerabilities: [{ VulnerabilityID: 'CVE-fixture', Severity: severity, FixedVersion: '2.0' }] }] });
  assert.equal(blockingFindings(report('HIGH'), repo, 'linux/amd64').length, 0);
  assert.equal(blockingFindings(report('CRITICAL'), repo, 'linux/amd64').length, 1);
  assert.equal(blockingFindings(report('CRITICAL'), repo, 'linux/arm64').length, 0);
  assert.equal(blockingFindings(report('CRITICAL'), 'budget-buddy-org/budget-buddy-api', 'linux/amd64').length, 0);
  const unfixed = report('CRITICAL'); delete unfixed.Results[0].Vulnerabilities[0].FixedVersion;
  assert.equal(blockingFindings(unfixed, repo, 'linux/amd64').length, 0);
  assert.equal(blockingFindings({ SchemaVersion: 2, Results: [{ Secrets: [{ RuleID: 'fixture', Severity: 'CRITICAL' }] }] }, repo, 'linux/amd64').length, 1);
  assert.throws(() => blockingFindings({}, repo, 'linux/amd64'));
  assert.throws(() => blockingFindings(report('HIGH'), 'unknown/repository', 'linux/amd64'));
});
test('index validation requires both real Linux platforms and binds source/version', () => {
  const index = { manifests: ['amd64', 'arm64'].map(architecture => ({ platform: { os: 'linux', architecture } })), annotations: { 'org.opencontainers.image.revision': sha, 'org.opencontainers.image.version': '1.2.3' } };
  validateIndex(index, sha, '1.2.3');
  assert.throws(() => validateIndex({ ...index, manifests: index.manifests.slice(1) }, sha, '1.2.3'));
  assert.throws(() => validateIndex(index, 'c'.repeat(40), '1.2.3'));
});
test('signature verification binds the reusable signer identity and the caller repository', () => {
  const claims = { iss: 'https://token.actions.githubusercontent.com', aud: 'sigstore', repository: repo, job_workflow_ref: 'budget-buddy-org/ci-workflows/.github/workflows/publish-image.yml@' + sha };
  assert.equal(signingIdentity(claims, repo), 'https://github.com/' + claims.job_workflow_ref);
  assert.throws(() => signingIdentity(claims, 'other/repository'));
  assert.throws(() => signingIdentity({ ...claims, job_workflow_ref: 'other/repo/.github/workflows/publish-image.yml@main' }, repo));
  assert.throws(() => signingIdentity({ ...claims, iss: 'https://untrusted.example' }, repo));
});
test('promotion is immutable, retries are idempotent, and old releases cannot roll aliases back', () => {
  assert.deepEqual(promotionTags(repo, '1.2.3', 'v1.2.3', '', digest), ['ghcr.io/' + repo + ':1.2.3', 'ghcr.io/' + repo + ':1.2', 'ghcr.io/' + repo + ':latest']);
  assert.equal(promotionTags(repo, '1.2.3', 'v1.2.3', digest, digest).length, 3);
  assert.deepEqual(promotionTags(repo, '1.2.3', 'v1.3.0', digest, digest), ['ghcr.io/' + repo + ':1.2.3']);
  assert.throws(() => promotionTags(repo, '1.2.3', 'v1.2.3', 'sha256:' + 'c'.repeat(64), digest));
});
