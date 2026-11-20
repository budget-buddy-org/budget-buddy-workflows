import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function signingIdentity(claims, repository) {
  if (claims.iss !== 'https://token.actions.githubusercontent.com' || claims.aud !== 'sigstore' || claims.repository !== repository) {
    throw new Error('Unexpected signing token issuer, audience, or caller');
  }
  const prefixes = [
    'budget-buddy-org/budget-buddy-workflows/.github/workflows/publish-image.yml@',
    'budget-buddy-org/ci-workflows/.github/workflows/publish-image.yml@',
  ];
  if (!prefixes.some(prefix => claims.job_workflow_ref?.startsWith(prefix)) || !/^[A-Za-z0-9._/-]+@[A-Za-z0-9._/-]+$/.test(claims.job_workflow_ref)) {
    throw new Error('Unexpected signing workflow identity');
  }
  return `https://github.com/${claims.job_workflow_ref}`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set('audience', 'sigstore');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } });
  if (!response.ok) throw new Error(`Signing identity request failed (${response.status})`);
  const { value } = await response.json();
  const claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
  const identity = signingIdentity(claims, process.env.GITHUB_REPOSITORY);
  appendFileSync(process.env.GITHUB_OUTPUT, `identity=${identity}\n`);
}
