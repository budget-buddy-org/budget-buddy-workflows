module.exports = {
  extends: [require.resolve('@commitlint/config-conventional')],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert', 'ops',
    ]],
    'subject-case': [0],
  },
};
