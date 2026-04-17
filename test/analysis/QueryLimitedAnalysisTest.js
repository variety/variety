// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import Tester from '../utils/Tester.js';
import sampleData from '../fixtures/SampleData.js';
const test = new Tester('test', 'users');

describe('Query-limited analysis', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should return only filtered values', async () => {
    const results = await test.runJsonAnalysis({collection:'users', query:{birthday:{$exists: true}}});
    results.validateResultsCount(5);
    results.validate('_id', 2, 100.0, {ObjectId: 2});
    results.validate('birthday', 2, 100.0, {Date: 2});
    results.validate('name', 2, 100.0, {String: 2});
    results.validate('bio', 1, 50.0, {String: 1});
    results.validate('pets', 1, 50.0, {String: 1});
  });

  it('should use the real filtered document count when limit exceeds query matches', async () => {
    // Issue #171 (@sylido): percentages should be based on the analyzed
    // document count, not the requested limit or a stale cursor count.
    const results = await test.runJsonAnalysis({
      collection: 'users',
      query: { pets: { $exists: true } },
      limit: 10
    });

    results.validateResultsCount(6);
    results.validate('_id', 2, 100.0, {ObjectId: 2});
    results.validate('name', 2, 100.0, {String: 2});
    results.validate('pets', 2, 100.0, {Array: 1, String: 1});
    results.validate('bio', 1, 50.0, {String: 1});
    results.validate('birthday', 1, 50.0, {Date: 1});
    results.validate('someWeirdLegacyKey', 1, 50.0, {String: 1});
  });

  it('should compute percentages from the post-sort limited subset', async () => {
    const results = await test.runJsonAnalysis({
      collection: 'users',
      query: { bio: { $exists: true } },
      sort: { name: 1 },
      limit: 2
    });

    results.validateResultsCount(4);
    results.validate('_id', 2, 100.0, {ObjectId: 2});
    results.validate('name', 2, 100.0, {String: 2});
    results.validate('bio', 2, 100.0, {String: 2});
    results.validate('birthday', 1, 50.0, {Date: 1});
  });
});
