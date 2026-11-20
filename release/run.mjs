import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import semanticRelease from 'semantic-release';

const require = createRequire(import.meta.url);
export async function configuration(profile) {
  if (!['application', 'gradle-app', 'web-app', 'contracts'].includes(profile)) {
    throw new Error('Unknown release profile');
  }
  const { default: config } = await import(`./${profile}.mjs`);
  return {
    ...config,
    plugins: config.plugins.map(plugin => {
      const [name, options] = Array.isArray(plugin) ? plugin : [plugin];
      return [require.resolve(name), options ?? {}];
    }),
  };
}

export function configurePreview(config, dryRun, previewBranch) {
  if (!['true', 'false'].includes(dryRun)) throw new Error('Invalid dry-run flag');
  if (dryRun === 'true') {
    if (!previewBranch) throw new Error('Missing preview branch');
    return { ...config, dryRun: true, branches: [previewBranch] };
  }
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = configurePreview(
    await configuration(process.env.RELEASE_PROFILE),
    process.env.DRY_RUN,
    process.env.PREVIEW_BRANCH,
  );
  await semanticRelease(config, { cwd: process.cwd() });
}
