import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'api/dist', 'node_modules', 'fake-training.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // tsconfig enables noUncheckedIndexedAccess, so `arr[i]!` after a bounds check is the
      // intended escape hatch. The compiler check is stricter than this lint rule.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // The Azure Functions API runs on Node.
    files: ['api/**/*.{ts,mjs}'],
    languageOptions: { globals: globals.node },
  },
)
