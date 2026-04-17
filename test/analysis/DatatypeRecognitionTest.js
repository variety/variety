// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
import {
  Binary,
  BSONRegExp,
  Code,
  DBRef,
  Decimal128,
  Double,
  Int32,
  Long,
  MaxKey,
  MinKey,
  ObjectId,
  Timestamp,
  UUID
} from 'mongodb';
import Tester from '../utils/Tester.js';
const test = new Tester('test', 'users');

const crazyObject = {
  key_string: 'Just plain String',
  key_boolean: true,
  key_number: 1,
  key_date: new Date(),
  'key_binData-generic': new Binary(Uint8Array.from([49, 50, 51, 52])), // TODO: how to create other bin-data types?
  'key_binData-uuid': new UUID('00112233-4455-6677-8899-aabbccddeeff'),
  key_array: [],
  key_object: {},
  key_null: null,
  key_long: Long.fromString('4611686018427387904'),
  key_decimal128: Decimal128.fromString('12.34'),
  key_timestamp: new Timestamp({ t: 1, i: 2 }),
  key_code: new Code('function () { return answer; }', { answer: 42 }),
  key_regexp: new BSONRegExp('^abc$', 'i'),
  key_minKey: new MinKey(),
  key_maxKey: new MaxKey(),
  key_dbRef: new DBRef('widgets', new ObjectId(), 'test'),
  key_double: new Double(3.14),
  key_int32: new Int32(7)
};

describe('Data type recognition', () => {

  beforeEach(() => test.init([crazyObject]));
  afterEach(() => test.cleanUp());

  it('should recognize all supported data types', async () => {
    // Issue #164 (@vitorcampos-db): BSON wrappers should stay distinct from
    // plain Object and should not expand into nested subkeys during analysis.
    const results = await test.runJsonAnalysis({collection:'users'}, true);
    results.validateResultsCount(20);
    results.validate('_id', 1, 100.0, {ObjectId: 1});
    results.validate('key_string', 1, 100.0, {String: 1});
    results.validate('key_boolean', 1, 100.0, {Boolean: 1});
    results.validate('key_number', 1, 100.0, {Number: 1});
    results.validate('key_date', 1, 100.0, {Date: 1});
    results.validate('key_binData-generic', 1, 100.0, {'BinData-generic': 1});
    results.validate('key_binData-uuid', 1, 100.0, {'BinData-UUID': 1});
    results.validate('key_array', 1, 100.0, {Array: 1});
    results.validate('key_object', 1, 100.0, {Object: 1});
    results.validate('key_null', 1, 100.0, {null: 1}); // TODO: why has 'null' first letter lowercase, unlike all other types?
    results.validate('key_long', 1, 100.0, {NumberLong: 1});
    results.validate('key_decimal128', 1, 100.0, {Decimal128: 1});
    results.validate('key_timestamp', 1, 100.0, {Timestamp: 1});
    results.validate('key_code', 1, 100.0, {Code: 1});
    results.validate('key_regexp', 1, 100.0, {BSONRegExp: 1});
    results.validate('key_minKey', 1, 100.0, {MinKey: 1});
    results.validate('key_maxKey', 1, 100.0, {MaxKey: 1});
    results.validate('key_dbRef', 1, 100.0, {DBRef: 1});
    // mongosh promotes BSON Double and Int32 to plain JavaScript numbers.
    results.validate('key_double', 1, 100.0, {Number: 1});
    results.validate('key_int32', 1, 100.0, {Number: 1});
  });
});
