import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Module boundaries (see AGENTS.md). Each key may import only from the listed modules.
const MODULES = ['shared', 'physics', 'rules', 'ai', 'render', 'input', 'ui', 'audio', 'state'];
const ALLOWED_IMPORTS = {
  shared: [],
  physics: ['shared'],
  rules: ['shared'],
  ai: ['shared', 'physics', 'rules'],
  render: ['shared'],
  input: ['shared'],
  ui: ['shared'],
  audio: ['shared'],
  state: ['shared', 'physics', 'rules', 'ai', 'render', 'input', 'ui', 'audio'],
};

const boundaryConfigs = MODULES.map((mod) => {
  const forbidden = MODULES.filter((m) => m !== mod && !ALLOWED_IMPORTS[mod].includes(m));
  return {
    files: [`src/${mod}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: forbidden.map((m) => ({
            group: [`../${m}`, `../${m}/**`, `**/src/${m}/**`],
            message: `src/${mod} may not import from src/${m}. Allowed: ${
              ALLOWED_IMPORTS[mod].join(', ') || 'nothing'
            }. Put shared types in src/shared.`,
          })),
        },
      ],
    },
  };
});

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['*.config.{js,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Determinism: physics and rules must never use wall-clock time or unseeded randomness.
    files: ['src/physics/**/*.ts', 'src/rules/**/*.ts', 'src/ai/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG from src/shared.' },
        {
          object: 'Date',
          property: 'now',
          message: 'Simulation must not depend on wall-clock time.',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'Simulation must not depend on wall-clock time.',
        },
      ],
    },
  },
  ...boundaryConfigs,
  prettier,
);
