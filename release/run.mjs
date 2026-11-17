import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import semanticRelease from 'semantic-release';

const require = createRequire(import.meta.url);
export async function configuration(profile) {
  if (!['gradle-app', 'web-app', 'contracts'].includes(profile)) {
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = await configuration(process.env.RELEASE_PROFILE);
  if (!['true', 'false'].includes(process.env.DRY_RUN)) throw new Error('Invalid dry-run flag');
  if (process.env.DRY_RUN === 'true') {
    if (!process.env.PREVIEW_BRANCH) throw new Error('Missing preview branch');
    config.dryRun = true;
    config.branches = [process.env.PREVIEW_BRANCH];
  }
  await semanticRelease(config, { cwd: process.cwd() });
}
