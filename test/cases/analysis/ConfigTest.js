// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const configModule = /** @type {typeof import('../../../core/config.js')} */ (require('../../../core/config.js'));

const {
  ANALYSIS_OPTION_NAMES,
  materializeAnalysisConfig,
  resolveAnalysisOptions,
  validateAnalysisOptions,
} = configModule;

describe('Shared analysis config', () => {
  it('applies shared defaults and materializes excludeSubkeys for engine use', () => {
    const resolved = resolveAnalysisOptions({
      excludeSubkeys: ['meta.tags'],
      maxExamples: 3,
    }, {
      collectionName: 'users',
      getDefaultLimit(query) {
        assert.deepEqual(query, {});
        return 5;
      },
    });

    assert.deepEqual(ANALYSIS_OPTION_NAMES, [
      'query',
      'sort',
      'limit',
      'maxDepth',
      'outputFormat',
      'maxExamples',
      'lastValue',
      'showArrayElements',
      'compactArrayTypes',
      'arrayEscape',
      'excludeSubkeys',
      'logKeysContinuously',
      'persistResults',
      'resultsDatabase',
      'resultsCollection',
      'resultsUser',
      'resultsPass',
    ]);
    assert.deepEqual(resolved, {
      arrayEscape: 'XX',
      compactArrayTypes: false,
      excludeSubkeys: ['meta.tags'],
      lastValue: false,
      limit: 5,
      logKeysContinuously: false,
      maxDepth: 99,
      maxExamples: 3,
      outputFormat: 'ascii',
      persistResults: false,
      query: {},
      resultsCollection: 'usersKeys',
      resultsDatabase: 'varietyResults',
      resultsPass: null,
      resultsUser: null,
      showArrayElements: false,
      sort: { _id: -1 },
    });

    assert.deepEqual(materializeAnalysisConfig(resolved), {
      arrayEscape: 'XX',
      compactArrayTypes: false,
      excludeSubkeys: { 'meta.tags.': true },
      lastValue: false,
      limit: 5,
      logKeysContinuously: false,
      maxDepth: 99,
      maxExamples: 3,
      outputFormat: 'ascii',
      persistResults: false,
      query: {},
      resultsCollection: 'usersKeys',
      resultsDatabase: 'varietyResults',
      resultsPass: null,
      resultsUser: null,
      showArrayElements: false,
      sort: { _id: -1 },
    });
  });

  it('accepts explicit limit and resultsCollection without dynamic-default context', () => {
    const resolved = resolveAnalysisOptions({
      limit: 12,
      query: { status: 'open' },
      resultsCollection: 'customKeys',
    });

    assert.equal(resolved.limit, 12);
    assert.equal(resolved.resultsCollection, 'customKeys');
    assert.deepEqual(resolved.query, { status: 'open' });
  });

  it('validates typed analysis options independently of CLI parsing', () => {
    assert.throws(
      () => {
        validateAnalysisOptions(/** @type {any} */ ({ query: [] }));
      },
      /query must be an object/
    );

    assert.throws(
      () => {
        validateAnalysisOptions({ maxExamples: -1 });
      },
      /maxExamples must be a non-negative integer/
    );

    assert.throws(
      () => {
        validateAnalysisOptions(/** @type {any} */ ({ excludeSubkeys: 'meta.tags' }));
      },
      /excludeSubkeys must be an array of strings/
    );
  });

  it('requires context when deriving dynamic defaults', () => {
    assert.throws(
      () => {
        resolveAnalysisOptions({});
      },
      /getDefaultLimit context is required/
    );
  });
});
