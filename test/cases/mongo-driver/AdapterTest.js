// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert/strict';
import { createRequire } from 'module';
import { BSONSymbol } from 'mongodb';
import sampleData from '../../fixtures/seed-data.js';
import AnalysisResultsValidator from '../../helpers/AnalysisResultsValidator.js';
import VarietyHarness from '../../helpers/VarietyHarness.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const driverAdapterModule = /** @type {typeof import('../../../mongo-driver/adapter.js')} */ (require('../../../mongo-driver/adapter.js'));
const { analyzeCollection, analyzeDbCollection } = driverAdapterModule;

const test = new VarietyHarness('test', 'users');

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
 * @param {import('mongodb').Document[]} documents
 * @returns {import('mongodb').Collection<import('mongodb').Document>}
 */
const createFakeCollection = (documents) => {
  const state = {
    limit: 0,
  };

  return /** @type {import('mongodb').Collection<import('mongodb').Document>} */ ({
    collectionName: 'fake',
    countDocuments(/** @type {Record<string, unknown>} */ query, options) {
      assert.deepEqual(query, {});
      const limit = options && typeof options.limit === 'number' ? options.limit : documents.length;
      return Promise.resolve(Math.min(limit, documents.length));
    },
    find(/** @type {Record<string, unknown>} */ query) {
      assert.deepEqual(query, {});

      return {
        sort(/** @type {Record<string, unknown>} */ sortSpec) {
          assert.deepEqual(sortSpec, { _id: -1 });
          return this;
        },
        limit(/** @type {number} */ limit) {
          state.limit = limit;
          return this;
        },
        async *[Symbol.asyncIterator]() {
          const resultDocuments = state.limit > 0 ? documents.slice(0, state.limit) : documents;
          for (const document of resultDocuments) {
            await Promise.resolve();
            yield document;
          }
        },
      };
    },
  });
};

describe('MongoDB Node driver adapter', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('analyzes a MongoDB Collection directly and returns structured results', async () => {
    const results = new AnalysisResultsValidator(
      await analyzeCollection(getConnectedCollection(), { lastValue: true })
    );

    results.validateResultsCount(7);
    results.validate('_id', 5, 100.0, { ObjectId: 5 });
    results.validate('name', 5, 100.0, { String: 5 }, 'Jim');
    results.validate('bio', 3, 60.0, { String: 3 }, 'Ça va?');
    results.validate('birthday', 2, 40.0, { Date: 2 }, '1984-03-14T00:00:00.000Z');
    results.validate('pets', 2, 40.0, { String: 1, Array: 1 }, 'egret');
    results.validate('someBinData', 1, 20.0, { 'BinData-generic': 1 });
    results.validate('someWeirdLegacyKey', 1, 20.0, { String: 1 }, 'I like Ike!');
  });

  it('analyzes a Db plus collectionName and keeps limited-percent semantics', async () => {
    const results = new AnalysisResultsValidator(
      await analyzeDbCollection(test.getDb('test'), 'users', {
        limit: 2,
        query: { bio: { $exists: true } },
        sort: { name: 1 },
      })
    );

    results.validateResultsCount(4);
    results.validate('_id', 2, 100.0, { ObjectId: 2 });
    results.validate('name', 2, 100.0, { String: 2 });
    results.validate('bio', 2, 100.0, { String: 2 });
    results.validate('birthday', 1, 50.0, { Date: 1 });
  });

  it('preserves driver-native BSON wrappers yielded by the cursor', async () => {
    const results = new AnalysisResultsValidator(
      await analyzeCollection(createFakeCollection([{ symbol: new BSONSymbol('mysymbol') }]))
    );

    results.validateResultsCount(1);
    results.validate('symbol', 1, 100.0, { BSONSymbol: 1 });
  });

  it('rejects formatter, persistence, plugin, and shell-only options clearly', async () => {
    await assert.rejects(
      analyzeCollection(createFakeCollection([]), { outputFormat: 'json' }),
      /does not support "outputFormat"/
    );
    await assert.rejects(
      analyzeCollection(createFakeCollection([]), { persistResults: true }),
      /does not support "persistResults"/
    );
    await assert.rejects(
      analyzeCollection(createFakeCollection([]), /** @type {any} */ ({ plugins: './csv-plugin.js' })),
      /does not support "plugins"/
    );
    await assert.rejects(
      analyzeCollection(createFakeCollection([]), /** @type {any} */ ({ secondaryOk: true })),
      /does not support "secondaryOk"/
    );
  });

  it('rejects unknown option keys before starting analysis', async () => {
    await assert.rejects(
      analyzeCollection(createFakeCollection([]), /** @type {any} */ ({ banana: true })),
      /Unknown MongoDB Node driver analysis option: "banana"/
    );
  });
});
