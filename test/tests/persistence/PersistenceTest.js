// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import VarietyHarness from '../../helpers/VarietyHarness.js';
import sampleData from '../../fixtures/SampleData.js';

/** @typedef {import('../../helpers/AnalysisResultsValidator.js').VarietyResultRow} VarietyResultRow */

const test = new VarietyHarness('test', 'users');

describe('Persistence of results', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should persist results into varietyResults DB', async () => {
    await test.runAnalysis({collection:'users', persistResults: true}, true);
    const db = test.getDb('varietyResults');
    /** @type {import('mongodb').Collection<VarietyResultRow>} */
    const resultsCollection = db.collection('usersKeys');
    const arr = await resultsCollection.find().toArray();
    assert.equal(arr.length, 7);
    const keys = arr.map(it => it._id.key);
    assert.deepEqual(keys, ['_id', 'name', 'bio', 'birthday', 'pets', 'someBinData', 'someWeirdLegacyKey']);
  });
});
