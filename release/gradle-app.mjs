import { commitAnalyzer } from './policy.mjs';

export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    commitAnalyzer,
    ['@semantic-release/release-notes-generator', {
      config: new URL('./release-notes-preset.mjs', import.meta.url).pathname,
    }],
    ['@semantic-release/changelog', {
      changelogFile: 'CHANGELOG.md',
    }],
    ['@semantic-release/exec', {
      prepareCmd: "sed -i 's/^version=.*/version=${nextRelease.version}/' gradle.properties",
    }],
    ['@semantic-release/git', {
      assets: ['CHANGELOG.md', 'gradle.properties'],
      message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
    }],
    '@semantic-release/github',
  ],
};
