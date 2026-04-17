// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import VarietyHarness from '../../helpers/VarietyHarness.js';
import { fileURLToPath } from 'url';
import sampleData from '../../fixtures/SampleData.js';

const test = new VarietyHarness('test', 'users');

const expectedOutput = `
key|types|occurrences|percents
_id|ObjectId|5|100
name|String|5|100
bio|String|3|60
birthday|Date|2|40
pets|Array,String|2|40
someBinData|BinData-generic|1|20
someWeirdLegacyKey|String|1|20
`.trim();

const getPluginPath = () => fileURLToPath(new URL('../../fixtures/CsvPlugin.js', import.meta.url));

describe('Plugins', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should load plugin and modify output', async () => {
    const output = await test.runAnalysis({collection:'users', plugins: getPluginPath()}, true);
    assert.equal(output, expectedOutput);
  });

  it('should read additional plugin params', async () => {
    const output = await test.runAnalysis({collection:'users', plugins: `${getPluginPath()}|delimiter=;`}, true);
    const expectedWithSeparator = expectedOutput.replace(/\|/g, ';');
    assert.equal(output, expectedWithSeparator);
  });

});
