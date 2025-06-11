const eslintPluginTs = require('@typescript-eslint/eslint-plugin')
const parserTs = require('@typescript-eslint/parser')
const prettierPlugin = require('eslint-plugin-prettier')
const configPrettier = require('eslint-config-prettier')

module.exports = [
  {
    ignores: ['dist', 'coverage', 'node_modules', 'documentation'],
    languageOptions: {
      parser: parserTs,
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    plugins: {
      '@typescript-eslint': eslintPluginTs,
      prettier: prettierPlugin
    },
    rules: {
      ...configPrettier.rules, // désactive les règles conflictuelles
      'prettier/prettier': 'error', // force le respect de Prettier
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': 'off'
    }
  }
]
