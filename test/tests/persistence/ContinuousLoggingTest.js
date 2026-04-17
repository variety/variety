// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import VarietyHarness from '../../helpers/VarietyHarness.js';
import sampleData from '../../fixtures/SampleData.js';

const test = new VarietyHarness('test', 'users');

const pattern = /^Found new key type "(.{1,})" type "(.{1,})"$/g;
const expectedLines = [
  'Found new key type "_id" type "ObjectId"',
  'Found new key type "name" type "String"',
  'Found new key type "someBinData" type "BinData-generic"',
  'Found new key type "bio" type "String"',
  'Found new key type "pets" type "String"',
  'Found new key type "birthday" type "Date"',
  'Found new key type "pets" type "Array"',
  'Found new key type "pets.XX" type "String"',
  'Found new key type "someWeirdLegacyKey" type "String"'
];



describe('Continuous logging', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should log every new key', async () => {
    const output = await test.runAnalysis({collection:'users', logKeysContinuously:true});
    const filteredOutput = output
      .split('\n')
      .filter(line => line.match(pattern));
    assert.equal(filteredOutput.length, expectedLines.length);
    expectedLines.forEach(expectedLine => {
      const found = filteredOutput.includes(expectedLine);
      assert.ok(found, `Expected line '${expectedLine}' not found in Variety output`);
    });
  });
});
