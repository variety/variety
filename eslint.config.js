'use strict';

const babelParser = require('@babel/eslint-parser');
const globals = require('globals');
const js = require('@eslint/js');

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
    rules: {
      'indent': [2, 2],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'brace-style': [2, '1tbs', { 'allowSingleLine': true }],
    },
  },
];
