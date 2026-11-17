import { commitAnalyzer } from './policy.mjs';

export default {
  branches: ['main'],
  plugins: [
    commitAnalyzer,
    ['@semantic-release/release-notes-generator', { config: new URL('./release-notes-preset.mjs', import.meta.url).pathname }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    ['@semantic-release/npm', { npmPublish: false }],
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
