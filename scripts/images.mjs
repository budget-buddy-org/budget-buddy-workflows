import { readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const policies = JSON.parse(readFileSync(new URL('../container-policy.json', import.meta.url), 'utf8'));
export const platforms = ['linux/amd64', 'linux/arm64'];
export function version(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value ?? '')) throw new Error('A stable semantic version is required');
  return value;
}
export function sourceSha(value) {
  if (!/^[a-f0-9]{40}$/.test(value ?? '')) throw new Error('Invalid source SHA');
  return value;
}
export function digest(value) {
  if (!/^sha256:[a-f0-9]{64}$/.test(value ?? '')) throw new Error('Invalid image digest');
  return value;
}
export function platform(value) {
  if (!platforms.includes(value)) throw new Error('Unsupported image platform');
  return value;
}
export function image(repository) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository ?? '')) throw new Error('Invalid repository');
  return `ghcr.io/${repository.toLowerCase()}`;
}
export function immutableImage(value) {
  if (!/^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(value ?? '')) throw new Error('An immutable image reference is required');
  return value;
}
export function versionFrom(content, file) {
  if (file === 'package.json') return version(JSON.parse(content).version);
  if (file === 'gradle.properties') return version(content.match(/^version=(.+)$/m)?.[1].trim());
  throw new Error('Unsupported version file');
}
export function versionFromTag(sourceRef) {
  const tag = (sourceRef ?? '').replace(/^refs\/tags\//, '');
  const match = /^(?:v)?(\d+\.\d+\.\d+)$/.exec(tag);
  if (!match) throw new Error('Production publication requires the matching release tag');
  return version(match[1]);
}
export function metadataVersion({ sourceRef, versionFile, versionContents, publish }) {
  return publish ? versionFromTag(sourceRef) : versionFrom(versionContents, versionFile);
}
export function validateRecords(records, repository, expectedVersion, sha, expectedPlatform) {
  const expected = expectedPlatform ? [platform(expectedPlatform)] : platforms;
  if (records.length !== expected.length) throw new Error('Unexpected image record count');
  const seen = new Set();
  for (const record of records) {
    if (record.image !== image(repository) || record.version !== version(expectedVersion) || record.sourceSha !== sourceSha(sha)) {
      throw new Error('Image records must match the repository, version, and source commit');
    }
    platform(record.platform);
    if (!expected.includes(record.platform) || seen.has(record.platform)) throw new Error('Duplicate or unexpected platform record');
    digest(record.digest);
    seen.add(record.platform);
  }
  return records;
}
export function blockingFindings(report, target) {
  platform(target);
  const severities = policies.blockingSeverities;
  if (report.SchemaVersion !== 2 || (report.Results !== undefined && !Array.isArray(report.Results))) throw new Error('Invalid Trivy report');
  return (report.Results ?? []).flatMap(result => [
    ...(result.Vulnerabilities ?? []).filter(item => item.FixedVersion && severities.includes(item.Severity)),
    ...(result.Secrets ?? []).filter(item => severities.includes(item.Severity)),
  ]);
}
export function validateIndex(index, sha, releaseVersion) {
  const linux = (index.manifests ?? []).filter(item => item.platform?.os === 'linux');
  const arches = new Set(linux.map(item => item.platform.architecture));
  if (arches.size !== 2 || !arches.has('amd64') || !arches.has('arm64')) throw new Error('Manifest must contain both supported Linux architectures');
  if (index.annotations?.['org.opencontainers.image.revision'] !== sha || index.annotations?.['org.opencontainers.image.version'] !== releaseVersion) {
    throw new Error('Manifest source/version annotations do not match the build');
  }
}
export function promotionTags(repository, releaseVersion, latestRelease, existingDigest, signedDigest) {
  const name = image(repository), v = version(releaseVersion);
  digest(signedDigest);
  if (existingDigest && digest(existingDigest) !== signedDigest) throw new Error('Refusing to replace immutable version content');
  const tags = [`${name}:${v}`];
  if (latestRelease === v || latestRelease === `v${v}`) tags.push(`${name}:${v.slice(0, v.lastIndexOf('.'))}`, `${name}:latest`);
  return tags;
}
function emit(values) {
  for (const [name, value] of Object.entries(values)) {
    if (/[\r\n]/.test(String(value))) throw new Error('Invalid workflow output');
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = process.env;
  switch (process.argv[2]) {
    case 'metadata': {
      if (!['true', 'false'].includes(env.PUBLISH_IMAGES)) throw new Error('Invalid publication mode');
      const publish = env.PUBLISH_IMAGES === 'true';
      const v = metadataVersion({
        sourceRef: env.SOURCE_REF,
        versionFile: env.VERSION_FILE,
        versionContents: publish ? undefined : readFileSync(env.VERSION_FILE, 'utf8'),
        publish,
      });
      const sha = sourceSha(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
      if (publish) {
        const tag = (env.SOURCE_REF ?? '').replace(/^refs\/tags\//, '');
        execFileSync('git', ['fetch', '--no-tags', 'origin', `refs/tags/${tag}:refs/tags/${tag}`], { stdio: 'inherit' });
        const tagged = execFileSync('git', ['rev-parse', `refs/tags/${tag}^{commit}`], { encoding: 'utf8' }).trim();
        if (tagged !== sha) throw new Error('Checkout does not match the release tag');
      }
      emit({ image: image(env.GITHUB_REPOSITORY), version: v, 'source-sha': sha });
      break;
    }
    case 'record': {
      const record = { image: image(env.GITHUB_REPOSITORY), version: version(env.IMAGE_VERSION), sourceSha: sourceSha(env.SOURCE_SHA), platform: platform(env.IMAGE_PLATFORM), digest: digest(env.IMAGE_DIGEST) };
      const directory = join(env.RUNNER_TEMP, 'image-records');
      mkdirSync(directory, { recursive: true });
      const file = join(directory, record.platform.replace('/', '-') + '.json');
      writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
      emit({ file, name: 'image-' + record.platform.replace('/', '-') });
      break;
    }
    case 'records': {
      const records = readdirSync(env.RECORDS_DIR).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(join(env.RECORDS_DIR, name), 'utf8')));
      validateRecords(records, env.GITHUB_REPOSITORY, env.IMAGE_VERSION, env.SOURCE_SHA, env.IMAGE_PLATFORM || undefined);
      const outputs = { image: image(env.GITHUB_REPOSITORY) };
      for (const record of records) outputs['digest-' + record.platform.split('/')[1]] = record.digest;
      if (records.length === 1) outputs.digest = records[0].digest;
      emit(outputs);
      break;
    }
    case 'scan-paths': {
      if (Boolean(env.IMAGE_REF) === Boolean(env.IMAGE_ARCHIVE)) throw new Error('Provide exactly one image reference or archive');
      if (env.IMAGE_ARCHIVE) {
        if (!statSync(env.IMAGE_ARCHIVE).isFile()) throw new Error('Image archive must be a file');
      } else immutableImage(env.IMAGE_REF);
      platform(env.IMAGE_PLATFORM);
      const directory = join(env.RUNNER_TEMP, 'image-scan-' + env.IMAGE_PLATFORM.replace('/', '-'));
      mkdirSync(directory, { recursive: true });
      emit({ json: join(directory, 'trivy.json'), sarif: join(directory, 'trivy.sarif'), category: 'trivy-' + env.IMAGE_PLATFORM.split('/')[1] });
      break;
    }
    case 'gate': {
      const findings = blockingFindings(JSON.parse(readFileSync(process.argv[3], 'utf8')), env.IMAGE_PLATFORM);
      for (const item of findings) console.log(`Blocking finding: ${item.VulnerabilityID ?? item.RuleID ?? 'secret'} (${item.Severity})`);
      console.log(`${findings.length} blocking image findings.`);
      if (findings.length) process.exitCode = 1;
      break;
    }
    case 'index':
      validateIndex(JSON.parse(readFileSync(process.argv[3], 'utf8')), sourceSha(env.SOURCE_SHA), version(env.IMAGE_VERSION));
      break;
    case 'promotion': {
      const tags = promotionTags(env.GITHUB_REPOSITORY, env.IMAGE_VERSION, env.LATEST_RELEASE, env.EXISTING_DIGEST, env.SIGNED_DIGEST);
      writeFileSync(env.PROMOTION_TAGS_FILE, tags.join('\n') + '\n');
      break;
    }
    default: throw new Error('Unknown image helper operation');
  }
}
