'use strict';

const babelParser = require('@babel/eslint-parser');
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

const typedSpecUtilsRules = {
  ...tseslint.configs.recommendedTypeChecked[2].rules,
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
  {
    files: ['spec/utils/**/*.js'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.checkjs.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: typedSpecUtilsRules,
  },
];
