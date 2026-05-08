// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert/strict';
import { createRequire } from 'module';
import parityData from '../../fixtures/parity-data.js';
import VarietyHarness from '../../helpers/VarietyHarness.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const driverAdapterModule = /** @type {typeof import('../../../mongo-driver/adapter.js')} */ (require('../../../mongo-driver/adapter.js'));
const { analyzeCollection } = driverAdapterModule;

const test = new VarietyHarness('test', 'parityUsers');

/**
 * @typedef {import('../../helpers/AnalysisResultsValidator.js').VarietyResultRow} VarietyResultRow
 * @typedef {Record<string, unknown>} AnalysisOptions
 */

/**
 * @returns {import('mongodb').Collection<import('mongodb').Document>}
 */
const getConnectedCollection = () => {
  if (!test.coll) {
    throw new Error('Collection connection is not available.');
  }

  return test.coll;
};

/**
 * @param {AnalysisOptions} options
 * @returns {Promise<VarietyResultRow[]>}
 */
const analyzeWithShell = async (options) => {
  /** @type {unknown} */
  const parsedRows = JSON.parse(await test.runAnalysis({
    collection: test.collectionName,
    ...options,
    outputFormat: 'json',
  }, true));

  if (!Array.isArray(parsedRows)) {
    throw new Error('Expected shell JSON output to be an array.');
  }

  const rows = /** @type {VarietyResultRow[]} */ (/** @type {unknown} */ (parsedRows));
  return rows;
};

/**
 * @param {AnalysisOptions} options
 * @returns {Promise<VarietyResultRow[]>}
 */
const analyzeWithDriver = async (options) => {
  return /** @type {VarietyResultRow[]} */ (await analyzeCollection(getConnectedCollection(), options));
};

/**
 * @param {VarietyResultRow[]} rows
 * @returns {unknown}
 */
const normalizeRows = (rows) => {
  return JSON.parse(JSON.stringify(rows));
};

describe('shell and MongoDB Node driver analysis parity', () => {
  beforeEach(() => test.init(parityData));
  afterEach(() => test.cleanUp());

  /** @type {{ name: string, options: AnalysisOptions }[]} */
  const parityCases = [
    {
      name: 'default analysis options',
      options: {},
    },
    {
      name: 'query, sort, and limit options',
      options: {
        limit: 2,
        query: { status: 'active' },
        sort: { rank: 1 },
      },
    },
    {
      name: 'depth-limited nested-object analysis',
      options: {
        maxDepth: 2,
        sort: { rank: 1 },
      },
    },
    {
      name: 'array and excluded-subkey options',
      options: {
        arrayEscape: 'ZZ',
        compactArrayTypes: true,
        excludeSubkeys: ['profile.address'],
        showArrayElements: true,
        sort: { rank: 1 },
      },
    },
    {
      name: 'representative last values and examples',
      options: {
        lastValue: true,
        maxExamples: 2,
        sort: { rank: 1 },
      },
    },
  ];

  parityCases.forEach(({ name, options }) => {
    it(`returns identical structured rows for ${name}`, async () => {
      const [shellRows, driverRows] = await Promise.all([
        analyzeWithShell(options),
        analyzeWithDriver(options),
      ]);

      assert.deepEqual(normalizeRows(driverRows), normalizeRows(shellRows));
    });
  });
});
