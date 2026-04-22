// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import { fileURLToPath } from 'url';
import sampleData from '../../fixtures/seed-data.js';
import VarietyHarness from '../../helpers/VarietyHarness.js';

const test = new VarietyHarness('test', 'users');

const getPluginPath = () => fileURLToPath(new URL('../../fixtures/plugins/read-pref-plugin.js', import.meta.url));

describe('Secondary reads', () => {
  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('sets the Mongo shell read preference to secondary when secondaryOk is true', async () => {
    const output = await test.runAnalysis({
      collection: 'users',
      plugins: getPluginPath(),
      secondaryOk: true,
    }, true);

    assert.equal(output.includes('someWeirdLegacyKey'), true);
  });
});
