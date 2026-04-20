// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import VarietyHarness from '../../helpers/VarietyHarness.js';
const test = new VarietyHarness('test', 'users');

import sampleData from '../../fixtures/seed-data.js';
import expectedAscii from '../../fixtures/ascii-output-fixture.js';

describe('Basic Analysis', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should return ASCII results', async () => {
    const output = await test.runAnalysis({collection:'users'}, true);
    assert.equal(output, expectedAscii);
  });

  it('should return JSON results', async () => {
    const results = await test.runJsonAnalysis({collection:'users', lastValue:true}, true);
    results.validateResultsCount(7);
    results.validate('_id', 5, 100.0, {ObjectId: 5});
    results.validate('name', 5, 100.0, {String: 5}, 'Jim');
    results.validate('bio', 3, 60.0, {String: 3}, 'Ça va?');
    results.validate('birthday', 2,  40.0, {Date: 2}, 448070400000);
    results.validate('pets', 2,  40.0, {String: 1, Array: 1}, 'egret');
    results.validate('someBinData', 1,  20.0, {'BinData-generic': 1});
    results.validate('someWeirdLegacyKey', 1,  20.0, {String: 1}, 'I like Ike!');
  });

  it('should collect up to maxExamples example values per key', async () => {
    // seed data sorted by _id desc: Jim, Geneviève, Harry, Dick, Tom
    const results = await test.runJsonAnalysis({collection:'users', maxExamples:3}, true);
    results.validateResultsCount(7);
    results.validateExamples('name', ['Jim', 'Geneviève', 'Harry']);
    results.validateExamples('bio', ['Ça va?', 'I swordfight.', 'A nice guy.']);
    results.validateExamples('pets', ['egret', '[Array]']);
    results.validateExamples('someWeirdLegacyKey', ['I like Ike!']);
  });
});
