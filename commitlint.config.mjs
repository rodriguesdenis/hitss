export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'mobile',
        'api-client',
        'docs',
        'adr',
        'spec',
        'ci',
        'infra',
        'deps',
        'agents',
      ],
    ],
    'body-max-line-length': [1, 'always', 100],
  },
};
