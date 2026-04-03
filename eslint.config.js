'use strict';

const babelParser = require('@babel/eslint-parser');
const globals = require('globals');
const js = require('@eslint/js');

const commonRules = {
  'brace-style': [2, '1tbs', { 'allowSingleLine': true }],
  'curly': ['error', 'all'],
  'eqeqeq': ['error', 'always'],
  'indent': [2, 2],
  'linebreak-style': ['error', 'unix'],
  'quotes': ['error', 'single'],
  'semi': ['error', 'always'],
};

const nodeModernizationRules = {
  'no-throw-literal': 'error',
  'no-var': 'error',
  'object-shorthand': ['error', 'always'],
  'prefer-const': 'error',
  'prefer-object-has-own': 'error',
  'prefer-template': 'error',
};

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        sourceType: 'module',
        requireConfigFile: false,
      },
      globals: {
        ...globals.node,
        ...globals.mocha,
        ...globals.mongo,
        __quiet: 'readonly',
        slaveOk: 'readonly',
        collection: 'readonly',
        DBQuery: 'readonly',
        BinData: 'readonly',
        tojson: 'readonly',
      },
    },
    rules: commonRules,
  },
  {
    files: ['eslint.config.js', 'spec/**/*.js'],
    ignores: ['spec/assets/**/*.js'],
    // Keep shell-executed files on the conservative shared ruleset until
    // the repo intentionally drops legacy mongo shell compatibility.
    rules: nodeModernizationRules,
  },
];
