import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';

const require = createRequire(resolve('tests/fixtures/node/package.json'));
const { load } = require('js-yaml');
const workflow = name => load(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));

test('release and dependency write privileges cannot run automatically for PRs', () => {
  const release = workflow('release');
  const expression = release.jobs.release.if.replaceAll('inputs.dry-run', "inputs['dry-run']");
  const allowed = new Function('github', 'inputs', `return (${expression});`);
  for (const event of ['pull_request', 'pull_request_target', 'issue_comment']) {
    for (const dry of [true, false]) assert.equal(allowed({ event_name: event, ref: 'refs/heads/main' }, { 'dry-run': dry }), false);
  }
  assert.equal(allowed({ event_name: 'push', ref: 'refs/heads/main' }, { 'dry-run': false }), true);
  assert.equal(allowed({ event_name: 'push', ref: 'refs/heads/feature' }, { 'dry-run': false }), false);
  assert.equal(allowed({ event_name: 'workflow_dispatch', ref: 'refs/heads/feature' }, { 'dry-run': true }), true);
  assert.equal(allowed({ event_name: 'workflow_dispatch', ref: 'refs/heads/main' }, { 'dry-run': false }), false);
  assert.deepEqual(release.permissions, { contents: 'read', packages: 'read' });
  assert.deepEqual(Object.keys(release.on.workflow_call.secrets).sort(), ['RELEASE_BOT_ID', 'RELEASE_BOT_PRIVATE_KEY']);
  const dependency = workflow('gradle-dependency-submission');
  const submit = new Function('github', `return (${dependency.jobs['dependency-submission'].if});`);
  assert.equal(submit({ event_name: 'pull_request', ref: 'refs/heads/main' }), false);
  assert.equal(submit({ event_name: 'push', ref: 'refs/heads/main' }), true);
});

test('PR validation stays read-only and runtime updates are trusted-event-only', () => {
  for (const name of ['validate', 'commitlint', 'web-ci', 'gradle-ci', 'contracts-validation']) {
    assert.deepEqual(workflow(name).permissions, { contents: 'read', packages: 'read' });
    assert.equal(workflow(name).on.pull_request_target, undefined);
  }
  const update = workflow('update-runtimes');
  assert.deepEqual(Object.keys(update.on).sort(), ['schedule', 'workflow_dispatch']);
  assert.deepEqual(update.permissions, { contents: 'read' });
  const app = update.jobs.update.steps.find(step => step.id === 'app-token');
  assert.equal(app.with['permission-contents'], 'write');
  assert.equal(app.with['permission-pull-requests'], 'write');
  assert.equal(app.with.repositories, '${{ github.event.repository.name }}');
  const checkout = update.jobs.update.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ github.event.repository.default_branch }}');
});

test('all third-party action dependencies are immutable commits', () => {
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (/\.ya?ml$/.test(path)) {
        const document = load(readFileSync(path, 'utf8'));
        function visit(value) {
          if (!value || typeof value !== 'object') return;
          if (typeof value.uses === 'string' && !value.uses.startsWith('./') && !value.uses.startsWith('$/')) {
            assert.match(value.uses, /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/, path);
          }
          for (const child of Object.values(value)) visit(child);
        }
        visit(document);
      }
    }
  }
  inspect('.github/workflows');
  inspect('.github/actions');
});

test('container signing and publication are unavailable to PR or push events', () => {
  const publish = workflow('publish-image');
  for (const job of Object.values(publish.jobs)) {
    const allowed = new Function('github', `return (${job.if});`);
    for (const event of ['pull_request', 'pull_request_target', 'push', 'issue_comment']) {
      assert.equal(allowed({ event_name: event, ref: 'refs/heads/main', event: { action: 'published' } }), false);
    }
    assert.equal(allowed({ event_name: 'release', event: { action: 'published' } }), true);
    assert.equal(allowed({ event_name: 'release', event: { action: 'created' } }), false);
    assert.equal(allowed({ event_name: 'workflow_dispatch' }), true);
  }
  assert.deepEqual(publish.jobs.publish.permissions, { contents: 'read', packages: 'write', 'id-token': 'write' });
  const action = load(readFileSync('.github/actions/publish-image/action.yml', 'utf8'));
  const steps = action.runs.steps;
  const sign = steps.findIndex(step => step.uses === '$/.github/actions/sign-image');
  const promote = steps.findIndex(step => step.name?.startsWith('Promote production'));
  assert.ok(sign >= 0 && sign < promote, 'promotion must follow successful signature verification');
  assert.equal(steps[promote].if, "inputs.publish == 'true'");
  assert.deepEqual(Object.keys(workflow('container-smoke').on).sort(), ['workflow_call', 'workflow_dispatch']);
  for (const job of Object.values(workflow('container-smoke').jobs)) {
    assert.equal(job.if, "github.event_name == 'workflow_dispatch'");
  }
  const trigger = workflow('validate').jobs.containers.if;
  const enabled = new Function('github', 'inputs', `return (${trigger});`);
  assert.equal(enabled({ event_name: 'pull_request' }, { containers: true }), false);
  assert.equal(enabled({ event_name: 'workflow_dispatch' }, { containers: true }), true);
  assert.equal(enabled({ event_name: 'workflow_dispatch' }, { containers: false }), false);
});
