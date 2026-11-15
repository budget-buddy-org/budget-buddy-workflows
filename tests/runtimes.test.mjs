import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestStable } from '../scripts/update-runtimes.mjs';

test('runtime updates exclude alphas, sort numeric versions, and reject an empty release set', () => {
  assert.equal(latestStable(['v24.22.3', 'v26.13.1', 'v27.0.0-alpha.0', 'v26.9.0']), '26.13.1');
  assert.equal(latestStable(['12.9.0', '12.18.0', '13.0.0-beta.1']), '12.18.0');
  assert.throws(() => latestStable(['v27.0.0-alpha.0']));
});
