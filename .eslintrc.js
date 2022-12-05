module.exports = {
  'parser': 'babel-eslint',
  'env': {
    'mongo': true,
    'node': true,
    'es6': true,
    'mocha': true
  },
  'extends': 'eslint:recommended',
  'rules': {
    'indent': [
      2,
      2
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    'quotes': [
      'error',
      'single'
    ],
    'semi': [
      'error',
      'always'
    ],
    'brace-style': [
      2,
      '1tbs',
      { 'allowSingleLine': true }
    ]
  },
  'globals': {
    '__quiet': false,
    'slaveOk': false,
    'collection': false,
    'DBQuery': false,
    'BinData': false,
    'NumberLong': false,
    'tojson': false
  },
  'parserOptions': {
    'sourceType': 'module'
  }
};
