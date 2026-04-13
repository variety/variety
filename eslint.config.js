'use strict';

const globals = require('globals');
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

const commonRules = {
  'brace-style': [2, '1tbs', { 'allowSingleLine': true }],
  'curly': ['error', 'all'],
  'eqeqeq': ['error', 'always'],
  'guard-for-in': 'error',
  'indent': [2, 2],
  'linebreak-style': ['error', 'unix'],
  'no-restricted-syntax': ['error',
    {
      selector: 'CallExpression[callee.name="Function"][arguments.0.value="return this"]',
      message: 'Capture the existing global object or use globalThis instead of Function(\'return this\').',
    },
    {
      selector: 'BinaryExpression[operator="!=="][left.type="CallExpression"][left.callee.property.name="indexOf"][right.value=-1]',
      message: 'Use includes() instead of indexOf() !== -1 for presence checks.',
    },
    {
      selector: 'BinaryExpression[operator="==="][left.type="CallExpression"][left.callee.property.name="indexOf"][right.value=-1]',
      message: 'Use !includes() instead of indexOf() === -1 for absence checks.',
    },
    {
      selector: 'BinaryExpression[operator=">"][left.type="CallExpression"][left.callee.property.name="indexOf"][right.value=-1]',
      message: 'Use includes() instead of indexOf() > -1 for presence checks.',
    },
    {
      selector: 'BinaryExpression[operator=">="][left.type="CallExpression"][left.callee.property.name="indexOf"][right.value=0]',
      message: 'Use includes() instead of indexOf() >= 0 for presence checks.',
    },
    {
      selector: 'BinaryExpression[operator="<"][left.type="CallExpression"][left.callee.property.name="indexOf"][right.value=0]',
      message: 'Use !includes() instead of indexOf() < 0 for absence checks.',
    },
  ],
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
  { ignores: ['.claude/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'script',
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
    files: ['spec/**/*.js'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['eslint.config.js', 'spec/**/*.js'],
    ignores: ['spec/assets/**/*.js'],
    // Keep shell-executed files on the conservative shared ruleset until
    // the repo intentionally drops legacy mongo shell compatibility.
    rules: nodeModernizationRules,
  },
  ...tseslint.config({
    files: ['spec/utils/**/*.js'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.checkjs.json',
        tsconfigRootDir: __dirname,
      },
    },
  }),
];
