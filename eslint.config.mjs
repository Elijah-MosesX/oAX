import tseslint from 'typescript-eslint';
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.vscode-test/**',
      '.pnpm-store/**',
      '.oax/**',
      '.tools/**',
      '**/.gradle/**',
      '**/.intellijPlatform/**',
      'adapters/jetbrains/build/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
);
