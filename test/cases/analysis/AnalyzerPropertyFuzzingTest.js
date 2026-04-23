// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert/strict';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fc from 'fast-check';

const require = createRequire(import.meta.url);
const enginePath = fileURLToPath(new URL('../../../core/engine.js', import.meta.url));

/**
 * @typedef {Record<string, unknown>} FuzzDocument
 * @typedef {{ types: Record<string, number>, totalOccurrences: number, lastValue?: unknown }} InterimResult
 * @typedef {{ _id: { key: string }, value: { types: Record<string, number> }, totalOccurrences: number, percentContaining: number }} VarietyResultRow
 * @typedef {{
 *   arrayEscape: string,
 *   excludeSubkeys: Record<string, true>,
 *   maxDepth: number,
 *   compactArrayTypes: boolean,
 *   lastValue: boolean,
 *   logKeysContinuously: boolean
 * }} AnalyzerConfig
 * @typedef {{
 *   createAnalysisState: () => Record<string, InterimResult>,
 *   ingestDocument: (
 *     config: AnalyzerConfig,
 *     accumulator: Record<string, InterimResult>,
 *     object: FuzzDocument,
 *     log: (message: string) => void
 *   ) => Record<string, InterimResult>,
 *   finalizeResults: (
 *     config: AnalyzerConfig,
 *     interimResults: Record<string, InterimResult>,
 *     documentsCount: number
 *   ) => VarietyResultRow[]
 *   analyzeDocuments: (
 *     config: AnalyzerConfig,
 *     documents: Iterable<FuzzDocument>,
 *     options?: { documentsCount?: number, log?: (message: string) => void }
 *   ) => VarietyResultRow[]
 * }} VarietyImpl
 */

const rawImpl = /** @type {unknown} */ (require(enginePath));
const impl = /** @type {VarietyImpl} */ (rawImpl);

const noop = () => {};

const keyArbitrary = fc.stringMatching(/^[a-z][a-z0-9_]{0,6}$/);
const scalarValueArbitrary = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer({ min: -1000, max: 1000 }),
  fc.string({ maxLength: 24 }),
  fc.date({ min: new Date('2000-01-01T00:00:00.000Z'), max: new Date('2030-12-31T23:59:59.999Z') })
);

const recursiveArbitraries = fc.letrec((tie) => ({
  value: fc.oneof(
    scalarValueArbitrary,
    fc.array(tie('value'), { maxLength: 4 }),
    fc.dictionary(keyArbitrary, tie('value'), { maxKeys: 4, noNullPrototype: true })
  ),
  document: fc.dictionary(keyArbitrary, tie('value'), { minKeys: 1, maxKeys: 5, noNullPrototype: true }),
}));

const documentArbitrary = /** @type {fc.Arbitrary<FuzzDocument>} */ (recursiveArbitraries['document']);
const documentsArbitrary = fc.array(documentArbitrary, { minLength: 1, maxLength: 8 });
const configArbitrary = fc.record({
  compactArrayTypes: fc.boolean(),
  maxDepth: fc.integer({ min: 1, max: 5 }),
});

/**
 * @param {{ compactArrayTypes: boolean, maxDepth: number }} options
 * @returns {AnalyzerConfig}
 */
const makeConfig = (options) => ({
  arrayEscape: 'XX',
  excludeSubkeys: {},
  maxDepth: options.maxDepth,
  compactArrayTypes: options.compactArrayTypes,
  lastValue: false,
  logKeysContinuously: false,
});

/**
 * @param {FuzzDocument[]} documents
 * @param {AnalyzerConfig} config
 * @returns {VarietyResultRow[]}
 */
const analyzeDocuments = (documents, config) => {
  const accumulator = impl.createAnalysisState();
  for (const document of documents) {
    impl.ingestDocument(config, accumulator, document, noop);
  }
  return impl.finalizeResults(config, accumulator, documents.length);
};

/**
 * @param {VarietyResultRow[]} results
 * @returns {Array<{ key: string, totalOccurrences: number, percentContaining: number, types: Record<string, number> }>}
 */
const normalizeResults = (results) => results
  .map((row) => {
    /** @type {Record<string, number>} */
    const sortedTypes = {};
    for (const typeName of Object.keys(row.value.types).sort()) {
      const typeCount = row.value.types[typeName];
      if (typeof typeCount !== 'number') {
        throw new Error(`Missing type count for ${row._id.key}:${typeName}`);
      }
      sortedTypes[typeName] = typeCount;
    }

    return {
      key: row._id.key,
      totalOccurrences: row.totalOccurrences,
      percentContaining: row.percentContaining,
      types: sortedTypes,
    };
  })
  .sort((left, right) => left.key.localeCompare(right.key));

/**
 * @param {VarietyResultRow[]} results
 * @param {number} documentsCount
 */
const assertSaneResults = (results, documentsCount) => {
  assert.ok(results.length > 0, 'analysis should find at least one key');

  for (const row of results) {
    assert.ok(row._id.key.length > 0, 'result keys should be non-empty');
    assert.ok(Number.isInteger(row.totalOccurrences), `${row._id.key} should have an integer occurrence count`);
    assert.ok(row.totalOccurrences >= 1, `${row._id.key} should occur in at least one document`);
    assert.ok(row.totalOccurrences <= documentsCount, `${row._id.key} should not occur more often than documents`);
    assert.equal(row.percentContaining, row.totalOccurrences * 100 / documentsCount);

    const typeNames = Object.keys(row.value.types);
    assert.ok(typeNames.length > 0, `${row._id.key} should include at least one type`);
    for (const typeName of typeNames) {
      const typeCount = row.value.types[typeName];
      if (typeof typeCount !== 'number') {
        throw new Error(`${row._id.key}:${typeName} should have a numeric count`);
      }
      assert.ok(Number.isInteger(typeCount), `${row._id.key}:${typeName} should have an integer count`);
      assert.ok(typeCount >= 1, `${row._id.key}:${typeName} should appear at least once`);
      assert.ok(typeCount <= row.totalOccurrences, `${row._id.key}:${typeName} should not exceed key occurrences`);
    }
  }
};

describe('Analyzer property fuzzing', () => {

  it('should produce sane counts for generated documents', () => {
    fc.assert(
      fc.property(documentsArbitrary, configArbitrary, (documents, options) => {
        const results = analyzeDocuments(documents, makeConfig(options));
        assertSaneResults(results, documents.length);
      }),
      { numRuns: 200, seed: 29103 }
    );
  });

  it('should produce the same result regardless of document order', () => {
    fc.assert(
      fc.property(documentsArbitrary, configArbitrary, (documents, options) => {
        const config = makeConfig(options);
        const forwardResults = normalizeResults(analyzeDocuments(documents, config));
        const reversedResults = normalizeResults(analyzeDocuments([...documents].reverse(), config));

        assert.deepEqual(forwardResults, reversedResults);
      }),
      { numRuns: 200, seed: 29104 }
    );
  });

  it('should infer the document count for non-array iterables', () => {
    /** @type {FuzzDocument[]} */
    const documents = [
      { common: 1, onlyFirst: true },
      { common: 2 },
    ];
    const config = makeConfig({ compactArrayTypes: false, maxDepth: 5 });
    function* generator() {
      yield* documents;
    }

    const results = impl.analyzeDocuments(config, generator(), { log: noop });
    const normalized = normalizeResults(results);

    assert.deepEqual(normalized, [
      {
        key: 'common',
        totalOccurrences: 2,
        percentContaining: 100,
        types: { Number: 2 },
      },
      {
        key: 'onlyFirst',
        totalOccurrences: 1,
        percentContaining: 50,
        types: { Boolean: 1 },
      },
    ]);
  });

});
