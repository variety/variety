// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
'use strict';

const path = require('path');
const varietyConfigModule = /** @type {typeof import('../core/config.js')} */ (require('../core/config.js'));
const {
  materializeAnalysisConfig,
  resolveAnalysisOptions,
  validateAnalysisOptions,
} = varietyConfigModule;

/** @typedef {import('mongodb').Db} MongoDb */
/** @typedef {import('mongodb').Document} MongoDocument */
/** @typedef {import('mongodb').Collection<MongoDocument>} MongoCollection */
/** @typedef {NonNullable<Parameters<typeof validateAnalysisOptions>[0]>} AnalysisOptionsInput */
/** @typedef {ReturnType<typeof materializeAnalysisConfig>} MaterializedAnalysisConfig */

/**
 * @typedef {{
 *   _id: { key: string },
 *   value: { types: Record<string, number> },
 *   totalOccurrences: number,
 *   percentContaining: number,
 *   lastValue?: unknown,
 *   examples?: unknown[],
 * }} VarietyResultRow
 */

/**
 * @typedef {{
 *   createAnalysisState: () => Record<string, unknown>,
 *   ingestDocument: (
 *     config: MaterializedAnalysisConfig,
 *     accumulator: Record<string, unknown>,
 *     object: MongoDocument,
 *     log: (message: string) => void
 *   ) => Record<string, unknown>,
 *   finalizeResults: (
 *     config: MaterializedAnalysisConfig,
 *     interimResults: Record<string, unknown>,
 *     documentsCount: number
 *   ) => VarietyResultRow[],
 * }} VarietyEngineApi
 */

const engine = /** @type {VarietyEngineApi} */ (
  /** @type {unknown} */ (require(path.join(__dirname, '..', 'core', 'engine.js')))
);

const SUPPORTED_ANALYSIS_OPTION_NAMES = new Set([
  'query',
  'limit',
  'maxDepth',
  'sort',
  'excludeSubkeys',
  'arrayEscape',
  'showArrayElements',
  'compactArrayTypes',
  'lastValue',
  'maxExamples',
]);

/** @type {Record<string, string>} */
const UNSUPPORTED_OPTION_REASONS = {
  collection: 'select the target collection via the function argument instead.',
  hideFrequencyColumns: 'ASCII formatter layout does not apply to structured Node-driver results.',
  logKeysContinuously: 'continuous shell logging is outside this analysis-only adapter.',
  outputFormat: 'formatter selection belongs to shell and CLI entrypoints.',
  persistResults: 'result persistence is deferred and not yet supported here.',
  plugins: 'plugin loading is deferred pending a normalized plugin-definition model.',
  resultsCollection: 'result persistence is deferred and not yet supported here.',
  resultsDatabase: 'result persistence is deferred and not yet supported here.',
  resultsPass: 'result persistence is deferred and not yet supported here.',
  resultsUser: 'result persistence is deferred and not yet supported here.',
  secondaryOk: 'secondaryOk is a Mongo shell runtime option, not a Node-driver analysis option.',
};

/**
 * @param {AnalysisOptionsInput | undefined} input
 * @returns {Record<string, unknown>}
 */
const ensureOptionsObject = (input) => {
  if (typeof input === 'undefined') {
    return {};
  }

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('MongoDB Node driver analysis options must be an object.');
  }

  return input;
};

/**
 * @param {Record<string, unknown>} source
 * @returns {void}
 */
const assertSupportedOptions = (source) => {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'undefined') {
      continue;
    }

    if (Object.hasOwn(UNSUPPORTED_OPTION_REASONS, key)) {
      throw new Error(`The MongoDB Node driver adapter does not support ${JSON.stringify(key)}; ${UNSUPPORTED_OPTION_REASONS[key]}`);
    }

    if (!SUPPORTED_ANALYSIS_OPTION_NAMES.has(key)) {
      throw new Error(`Unknown MongoDB Node driver analysis option: ${JSON.stringify(key)}.`);
    }
  }
};

/**
 * @param {MongoCollection | unknown} collection
 * @returns {MongoCollection}
 */
const ensureCollection = (collection) => {
  if (
    !collection ||
    typeof collection !== 'object' ||
    typeof /** @type {{ countDocuments?: unknown }} */ (collection).countDocuments !== 'function' ||
    typeof /** @type {{ find?: unknown }} */ (collection).find !== 'function' ||
    typeof /** @type {{ collectionName?: unknown }} */ (collection).collectionName !== 'string' ||
    /** @type {{ collectionName: string }} */ (collection).collectionName.length === 0
  ) {
    throw new Error('Expected a MongoDB Collection with collectionName, countDocuments(), and find().');
  }

  return /** @type {MongoCollection} */ (collection);
};

/**
 * @param {MongoDb | unknown} db
 * @returns {MongoDb}
 */
const ensureDb = (db) => {
  if (!db || typeof db !== 'object' || typeof /** @type {{ collection?: unknown }} */ (db).collection !== 'function') {
    throw new Error('Expected a MongoDB Db with collection().');
  }

  return /** @type {MongoDb} */ (db);
};

/**
 * @param {string | unknown} collectionName
 * @returns {string}
 */
const ensureCollectionName = (collectionName) => {
  if (typeof collectionName !== 'string' || collectionName.length === 0) {
    throw new Error('collectionName must be a non-empty string.');
  }

  return collectionName;
};

/**
 * @param {MongoCollection} collection
 * @param {Record<string, unknown>} query
 * @param {number} [limit]
 * @returns {Promise<number>}
 */
const countMatchingDocuments = async (collection, query, limit) => {
  const options = (typeof limit === 'number' && limit > 0) ? { limit } : undefined;
  return collection.countDocuments(query, options);
};

/**
 * @param {AnalysisOptionsInput} validatedOptions
 * @returns {Record<string, unknown>}
 */
const readQuery = (validatedOptions) => {
  return Object.hasOwn(validatedOptions, 'query')
    ? /** @type {Record<string, unknown>} */ (validatedOptions.query)
    : {};
};

/**
 * @param {MongoCollection} collection
 * @param {AnalysisOptionsInput} validatedOptions
 * @returns {Promise<MaterializedAnalysisConfig>}
 */
const resolveDriverConfig = async (collection, validatedOptions) => {
  const query = readQuery(validatedOptions);
  const limit = Object.hasOwn(validatedOptions, 'limit')
    ? /** @type {number} */ (validatedOptions.limit)
    : await countMatchingDocuments(collection, query);

  const resolvedOptions = resolveAnalysisOptions(
    Object.assign({}, validatedOptions, { limit }),
    { collectionName: collection.collectionName }
  );

  return materializeAnalysisConfig(resolvedOptions);
};

/**
 * @param {MongoCollection} collection
 * @param {MaterializedAnalysisConfig} config
 * @returns {AsyncIterable<MongoDocument>}
 */
const buildCursor = (collection, config) => {
  let cursor = collection.find(config.query).sort(/** @type {import('mongodb').Sort} */ (config.sort));
  if (config.limit > 0) {
    cursor = cursor.limit(config.limit);
  }
  return cursor;
};

/**
 * @param {MongoCollection} collection
 * @param {AnalysisOptionsInput} [options]
 * @returns {Promise<VarietyResultRow[]>}
 */
const analyzeCollection = async (collection, options) => {
  const typedCollection = ensureCollection(collection);
  const source = ensureOptionsObject(options);
  assertSupportedOptions(source);
  const validatedOptions = /** @type {AnalysisOptionsInput} */ (validateAnalysisOptions(source));
  const config = await resolveDriverConfig(typedCollection, validatedOptions);
  const interimResults = engine.createAnalysisState();

  for await (const document of buildCursor(typedCollection, config)) {
    engine.ingestDocument(config, interimResults, document, () => {});
  }

  const documentsCount = await countMatchingDocuments(typedCollection, config.query, config.limit);
  return /** @type {VarietyResultRow[]} */ (engine.finalizeResults(config, interimResults, documentsCount));
};

/**
 * @param {MongoDb} db
 * @param {string} collectionName
 * @param {AnalysisOptionsInput} [options]
 * @returns {Promise<VarietyResultRow[]>}
 */
const analyzeDbCollection = async (db, collectionName, options) => {
  const typedDb = ensureDb(db);
  const typedCollectionName = ensureCollectionName(collectionName);
  return analyzeCollection(typedDb.collection(typedCollectionName), options);
};

module.exports = {
  analyzeCollection,
  analyzeDbCollection,
};
