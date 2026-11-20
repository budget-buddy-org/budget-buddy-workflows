import { commitAnalyzer } from './policy.mjs';

export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    commitAnalyzer,
    ['@semantic-release/release-notes-generator', {
      config: new URL('./release-notes-preset.mjs', import.meta.url).pathname,
    }],
    '@semantic-release/github',
  ],
};
