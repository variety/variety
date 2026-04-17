// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import Tester from '../utils/Tester.js';

/** @typedef {import('mongodb').Document} MongoDocument */

const test = new Tester('test', 'users');

/** @type {MongoDocument[]} */
const sampleData = [
  /** @type {MongoDocument} */ (JSON.parse('{"name":"Alice","constructor":"blue","hasOwnProperty":true,"__proto__":"shadow"}')),
  /** @type {MongoDocument} */ (JSON.parse('{"name":"Bob","constructor":42,"toString":"hello"}'))
];

describe('prototype-named keys', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should analyze keys that would otherwise collide with Object prototype properties', async () => {
    const results = await test.runJsonAnalysis({collection: 'users'}, true);
    results.validateResultsCount(6);
    results.validate('_id',            2, 100.0, {ObjectId: 2});
    results.validate('name',           2, 100.0, {String: 2});
    results.validate('constructor',    2, 100.0, {String: 1, Number: 1});
    results.validate('hasOwnProperty', 1,  50.0, {Boolean: 1});
    results.validate('__proto__',      1,  50.0, {String: 1});
    results.validate('toString',       1,  50.0, {String: 1});
  });

});
