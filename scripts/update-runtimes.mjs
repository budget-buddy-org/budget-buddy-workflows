import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function latestStable(versions) {
  const stable = versions.map(v => v.replace(/^v/, '')).filter(v => /^\d+\.\d+\.\d+$/.test(v));
  stable.sort((a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  });
  if (!stable.length) throw new Error('No stable runtime release found');
  return stable[0];
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [nodeResponse, pnpmResponse, trivyResponse, cosignResponse] = await Promise.all([
    fetch('https://nodejs.org/dist/index.json'),
    fetch('https://registry.npmjs.org/pnpm/latest'),
    fetch('https://api.github.com/repos/aquasecurity/trivy/releases/latest'),
    fetch('https://api.github.com/repos/sigstore/cosign/releases/latest'),
  ]);
  if (![nodeResponse, pnpmResponse, trivyResponse, cosignResponse].every(response => response.ok)) throw new Error('Runtime release lookup failed');
  const node = latestStable((await nodeResponse.json()).map(v => v.version));
  const pnpm = latestStable([(await pnpmResponse.json()).version]);
  const trivy = latestStable([(await trivyResponse.json()).tag_name]);
  const cosign = latestStable([(await cosignResponse.json()).tag_name]);
  const file = resolve('runtime-versions.json');
  const previous = JSON.parse(readFileSync(file, 'utf8'));
  const next = { node, pnpm, trivy, cosign };
  for (const name of Object.keys(next)) {
    if (previous[name] && latestStable([previous[name], next[name]]) !== next[name]) throw new Error(`Refusing to downgrade ${name}`);
  }
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  console.log(JSON.stringify({ previous, next }));
}
