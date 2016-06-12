import { Binary } from 'mongodb';
import { Long } from 'mongodb';
import Tester from './utils/Tester.js';
const test = new Tester('test', 'users');

const crazyObject = {
  key_string: 'Just plain String',
  key_boolean: true,
  key_number: 1,
  key_date: new Date(),
  'key_binData-generic': new Binary('1234'), // TODO: how to create other bin-data types?
  key_array: [],
  key_object: {},
  key_null: null,
  key_long: Long.fromString('4611686018427387904')
};

describe('Data type recognition', () => {

  beforeEach(() => test.init([crazyObject]));
  afterEach(() => test.cleanUp());

  it('should recognize all supported data types', async () => {
    const results = await test.runJsonAnalysis({collection:'users'}, true);
    results.validateResultsCount(10);
    results.validate('_id', 1, 100.0, {ObjectId: 1});
    results.validate('key_string', 1, 100.0, {String: 1});
    results.validate('key_boolean', 1, 100.0, {Boolean: 1});
    results.validate('key_number', 1, 100.0, {Number: 1});
    results.validate('key_date', 1, 100.0, {Date: 1});
    results.validate('key_binData-generic', 1, 100.0, {'BinData-generic': 1});
    results.validate('key_array', 1, 100.0, {Array: 1});
    results.validate('key_object', 1, 100.0, {Object: 1});
    results.validate('key_null', 1, 100.0, {null: 1}); // TODO: why has 'null' first letter lowercase, unlike all other types?
    results.validate('key_long', 1, 100.0, {NumberLong: 1});
  });
});
