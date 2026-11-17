import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const library = 'budget-buddy-org/ci-workflows';
export const consumers = ['budget-buddy-contracts', 'budget-buddy-api', 'budget-buddy-web-app'];
const reference = /budget-buddy-org\/ci-workflows\/[^\s@"']+@([^\s"'#]+)/g;
export function workflowFiles(root) {
  return readdirSync(join(root, '.github/workflows')).filter(n => /\.ya?ml$/.test(n)).map(n => join(root, '.github/workflows', n));
}
export function checkConsumer(root, revision, versions) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Expected an immutable library revision');
  const refs = workflowFiles(root).flatMap(p => [...readFileSync(p, 'utf8').matchAll(reference)].map(m => m[1]));
  if (!refs.length || refs.some(ref => ref !== revision)) throw new Error('Every shared action/workflow must use the same library revision');
  if (existsSync(join(root, 'package.json'))) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.packageManager !== `pnpm@${versions.pnpm}`) throw new Error('packageManager differs from the shared pnpm version');
  const lock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
  const manager = lock.match(/^    packageManagerDependencies:\n      pnpm:\n        specifier: ([\d.]+)\n        version: ([\d.]+)$/m);
  if (!manager || manager[1] !== versions.pnpm || manager[2] !== versions.pnpm) throw new Error('Regenerate pnpm lockfile metadata with the shared pnpm version');
  } else if (!existsSync(join(root, 'build.gradle.kts')) || existsSync(join(root, 'pnpm-lock.yaml'))) {
    throw new Error('Only Gradle consumers may omit Node tooling; remove its obsolete lockfile too');
  }
  if (existsSync(join(root, 'Dockerfile'))) {
    const docker = readFileSync(join(root, 'Dockerfile'), 'utf8');
    if (docker.match(/^ARG NODE_VERSION=(.+)$/m)?.[1] !== versions.node) throw new Error('Docker Node default differs from the shared version');
  }
  return { revision, node: versions.node, pnpm: versions.pnpm, references: refs.length };
}
export function updateConsumer(root, revision, versions) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid target revision');
  for (const file of workflowFiles(root)) {
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace(reference, match => match.slice(0, match.lastIndexOf('@') + 1) + revision));
  }
  const file = join(root, 'package.json');
  let changed = false;
  if (existsSync(file)) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  changed = pkg.packageManager !== `pnpm@${versions.pnpm}`;
  // Preserve unrelated formatting and package metadata.
  writeFileSync(file, readFileSync(file, 'utf8').replace(/("packageManager"\s*:\s*)"[^"]+"/, `$1"pnpm@${versions.pnpm}"`));
  }
  const docker = join(root, 'Dockerfile');
  if (existsSync(docker)) writeFileSync(docker, readFileSync(docker, 'utf8').replace(/^ARG NODE_VERSION=.+$/m, `ARG NODE_VERSION=${versions.node}`));
  return changed;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[3] ?? '.');
  const libraryRoot = fileURLToPath(new URL('../', import.meta.url));
  const revision = process.env.LIBRARY_REVISION || basename(libraryRoot.replace(/\/$/, ''));
  const versions = JSON.parse(readFileSync(join(libraryRoot, 'runtime-versions.json'), 'utf8'));
  if (process.argv[2] !== 'check') throw new Error('Unknown consumer policy operation');
  console.log(JSON.stringify(checkConsumer(root, revision, versions)));
}
