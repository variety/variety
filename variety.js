// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2012 James Cropcho <numerate_penniless652@dralias.com>
/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any
outliers to that schema. Particularly useful when you inherit a codebase with
data dump and want to quickly learn how the data's structured. Also useful for
finding rare keys.

Please see https://github.com/variety/variety for details. */

// -----------------------------------------------------------------------------
// GENERATED FILE — do not edit directly.
//
// Assembled by build.js from:
//   core/formatters/ascii.js, core/formatters/json.js,
//   core/config.js, core/engine.js, core/analyzer.js, mongo-shell/adapter.js.
// To change behavior, edit those source files and run `npm run build`. The
// build output is committed so `mongosh variety.js` works from a fresh clone
// without a build step; CI verifies the committed file matches its sources.
// -----------------------------------------------------------------------------

// JavaScript compatibility floor: this file runs inside a MongoDB shell —
// either mongosh (all versions, modern V8) or the legacy `mongo` shell
// (SpiderMonkey-based, shipped through MongoDB 5.x). The lowest common
// denominator is the ES6+ feature set available in the legacy shell since
// MongoDB 4.4: let/const, arrow functions, template literals, rest/spread,
// for…of, Object.keys()/Object.entries(), and class. Later additions such
// as Object.hasOwn() (ES2022) are absent and must not be used here.
// See .eslint.config.js for the enforced rule set.

// -----------------------------------------------------------------------------
// This file is organized in five sections, sourced from six separate files:
//
//   1. FORMATTER SECTION (core/formatters/ascii.js, core/formatters/json.js) —
//      built-in output formatters. Each is a self-contained IIFE that registers
//      a factory function on `shellContext.__varietyFormatters`. Third-party
//      formatters can be supplied as plugins instead (see README).
//
//   2. CONFIG SECTION (core/config.js) — shared analysis-option validation,
//      default resolution, and engine-facing materialization. Future callable
//      APIs can reuse this boundary without inheriting shell-launch details.
//
//   3. ENGINE SECTION (core/engine.js) — reusable analysis logic that keeps
//      persistence, formatter dispatch, and output side effects out of the
//      engine. It still tolerates shell/runtime helpers when they are
//      available. Functions take their dependencies (config, and where needed
//      a `log` function) as explicit parameters and return structured
//      analysis rows. The section hands a reusable engine to later sections
//      via `shellContext.__varietyEngine`.
//
//   4. ANALYZER SECTION (core/analyzer.js) — shell-adjacent orchestration for
//      cursor traversal, optional persistence, and formatter dispatch. Depends
//      on the engine and hands the combined internal API to the interface
//      section via `shellContext.__varietyImpl`.
//
//   5. INTERFACE SECTION (mongo-shell/adapter.js) — everything that touches
//      shell globals: reading input (`collection`, `plugins`, `__quiet`,
//      `secondaryOk`, etc.), the config-echo logging, plugin loading via
//      `load()`, input validation, and constructing the dependency bag
//      passed to `impl.run()`.
//
// The handoff properties are deleted at the end so the build is idempotent and
// does not pollute the shell's global namespace after execution.
// -----------------------------------------------------------------------------


// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// BUILT-IN FORMATTER: ASCII TABLE
// =============================================================================
(function (shellContext) {
  'use strict';

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  shellContext.__varietyFormatters = shellContext.__varietyFormatters || Object.create(null);

  /**
   * Returns a formatter that renders results as a padded ASCII table.
   * @param {object} config - The parsed Variety config (uses config.lastValue, config.maxExamples, and config.arrayEscape).
   * @returns {{ formatResults: function(Array): string }}
   */
  shellContext.__varietyFormatters.ascii = (config) => {
    const formatResults = (results) => {
      const headers = ['key', 'types', 'occurrences', 'percents'];
      if (config.lastValue) {
        headers.push('lastValue');
      }
      if (config.maxExamples > 0) {
        headers.push('examples');
      }

      // Return the number of decimal places, or 1 for integers (1.23 => 2, 100 => 1, 0.1415 => 4).
      const significantDigits = (value) => {
        const res = value.toString().match(/^[0-9]+\.([0-9]+)$/);
        return res !== null ? res[1].length : 1;
      };

      const maxDigits = results
        .map((value) => significantDigits(value.percentContaining))
        .reduce((acc, val) => Math.max(acc, val), 1);

      const rows = results.map((row) => {
        const typeKeys = Object.keys(row.value.types);
        const types = typeKeys.length > 1
          ? typeKeys.map((type) => `${type} (${row.value.types[type]})`)
          : typeKeys;

        const rawArray = [row._id.key, types, row.totalOccurrences, row.percentContaining.toFixed(Math.min(maxDigits, 20))];
        if (config.lastValue && row.lastValue) {
          rawArray.push(row.lastValue);
        }
        if (config.maxExamples > 0 && row.examples) {
          rawArray.push(row.examples.join(', '));
        }
        return rawArray;
      });

      const table = [headers, headers.map(() => '')].concat(rows);
      const colMaxWidth = (arr, index) => Math.max(...arr.map((row) => row[index] ? row[index].toString().length : 0));
      const pad = (width, string, symbol) => width <= string.length ? string : pad(width, isNaN(string) ? string + symbol : symbol + string, symbol);
      const formattedTable = table.map((row, ri) =>
        `| ${row.map((cell, i) => pad(colMaxWidth(table, i), cell.toString(), ri === 1 ? '-' : ' ')).join(' | ')} |`
      );
      const border = `+${pad(formattedTable[0].length - 2, '', '-')}+`;
      return [border].concat(formattedTable).concat(border).join('\n');
    };

    return {formatResults};
  };
}(this));


// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// BUILT-IN FORMATTER: JSON
// =============================================================================
(function (shellContext) {
  'use strict';

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  shellContext.__varietyFormatters = shellContext.__varietyFormatters || Object.create(null);

  /**
   * Returns a formatter that serializes results as pretty-printed JSON.
   * @returns {{ formatResults: function(Array): string }}
   */
  shellContext.__varietyFormatters.json = () => ({
    formatResults: (results) => JSON.stringify(results, null, 2),
  });
}(this));


// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// CONFIG SECTION
// =============================================================================
/**
 * @param {typeof globalThis} shellContext
 */
(function (shellContext) {
  'use strict';

  /**
   * @typedef {{
   *   arrayEscape?: string,
   *   compactArrayTypes?: boolean,
   *   excludeSubkeys?: string[],
   *   lastValue?: boolean,
   *   limit?: number,
   *   logKeysContinuously?: boolean,
   *   maxDepth?: number,
   *   maxExamples?: number,
   *   outputFormat?: string,
   *   persistResults?: boolean,
   *   query?: Record<string, unknown>,
   *   resultsCollection?: string,
   *   resultsDatabase?: string,
   *   resultsPass?: string | null,
   *   resultsUser?: string | null,
   *   showArrayElements?: boolean,
   *   sort?: Record<string, unknown>,
   * }} AnalysisOptionsInput
   */

  /**
   * @typedef {{
   *   arrayEscape: string,
   *   compactArrayTypes: boolean,
   *   excludeSubkeys: string[],
   *   lastValue: boolean,
   *   limit: number,
   *   logKeysContinuously: boolean,
   *   maxDepth: number,
   *   maxExamples: number,
   *   outputFormat: string,
   *   persistResults: boolean,
   *   query: Record<string, unknown>,
   *   resultsCollection: string,
   *   resultsDatabase: string,
   *   resultsPass: string | null,
   *   resultsUser: string | null,
   *   showArrayElements: boolean,
   *   sort: Record<string, unknown>,
   * }} ResolvedAnalysisOptions
   */

  /**
   * @typedef {Omit<ResolvedAnalysisOptions, 'excludeSubkeys'> & {
   *   excludeSubkeys: Record<string, boolean>,
   * }} MaterializedAnalysisConfig
   */

  /** @typedef {keyof ResolvedAnalysisOptions} AnalysisOptionName */

  /**
   * @typedef {{
   *   collectionName?: string,
   *   getDefaultLimit?: (query: Record<string, unknown>) => number,
   * }} AnalysisConfigContext
   */

  /**
   * @typedef {{
   *   ANALYSIS_OPTION_NAMES: AnalysisOptionName[],
   *   materializeAnalysisConfig: (resolvedOptions: ResolvedAnalysisOptions) => MaterializedAnalysisConfig,
   *   resolveAnalysisOptions: (input: AnalysisOptionsInput | undefined, context?: AnalysisConfigContext) => ResolvedAnalysisOptions,
   *   validateAnalysisOptions: (input: AnalysisOptionsInput | undefined) => AnalysisOptionsInput,
   * }} VarietyConfigApi
   */

  const root = /** @type {typeof globalThis & { __varietyConfig?: VarietyConfigApi }} */ (
    typeof globalThis !== 'undefined' ? globalThis : shellContext
  );

  /**
   * @param {object} value
   * @param {string} key
   * @returns {boolean}
   */
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  /** @type {AnalysisOptionName[]} */
  const ANALYSIS_OPTION_NAMES = [
    'query',
    'limit',
    'maxDepth',
    'sort',
    'outputFormat',
    'persistResults',
    'resultsDatabase',
    'resultsCollection',
    'resultsUser',
    'resultsPass',
    'logKeysContinuously',
    'excludeSubkeys',
    'arrayEscape',
    'showArrayElements',
    'compactArrayTypes',
    'lastValue',
    'maxExamples',
  ];

  /**
   * @param {unknown} value
   * @returns {value is Record<string, unknown>}
   */
  const isPlainObject = (value) => {
    return value !== null && !Array.isArray(value) && typeof value === 'object';
  };

  /**
   * @param {Record<string, unknown>} value
   * @returns {Record<string, unknown>}
   */
  const cloneObject = (value) => ({ ...value });

  /**
   * @param {AnalysisOptionsInput | undefined} value
   * @returns {Record<string, unknown>}
   */
  const ensureInputObject = (value) => {
    if (typeof value === 'undefined') {
      return {};
    }

    if (!isPlainObject(value)) {
      throw new Error('Analysis options must be an object.');
    }

    return value;
  };

  /**
   * @param {string} name
   * @param {unknown} value
   * @returns {boolean}
   */
  const validateBooleanOption = (name, value) => {
    if (typeof value !== 'boolean') {
      throw new Error(`${name} must be a boolean.`);
    }

    return value;
  };

  /**
   * @param {string} name
   * @param {unknown} value
   * @param {boolean} allowNull
   * @param {boolean} requireNonEmpty
   * @returns {string | null}
   */
  const validateStringOption = (name, value, allowNull, requireNonEmpty) => {
    if (allowNull && value === null) {
      return value;
    }

    if (typeof value !== 'string') {
      const nullClause = allowNull ? ' or null' : '';
      throw new Error(`${name} must be a string${nullClause}.`);
    }

    if (requireNonEmpty && value.length === 0) {
      throw new Error(`${name} must not be empty.`);
    }

    return value;
  };

  /**
   * @param {string} name
   * @param {unknown} value
   * @returns {string[]}
   */
  const validateStringArrayOption = (name, value) => {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      throw new Error(`${name} must be an array of strings.`);
    }

    return value.slice();
  };

  /**
   * @param {string} name
   * @param {unknown} value
   * @returns {Record<string, unknown>}
   */
  const validateObjectOption = (name, value) => {
    if (!isPlainObject(value)) {
      throw new Error(`${name} must be an object.`);
    }

    return cloneObject(value);
  };

  /**
   * @param {string} name
   * @param {unknown} value
   * @returns {number}
   */
  const validateNonNegativeIntegerOption = (name, value) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer.`);
    }

    return value;
  };

  /**
   * @param {string[]} excludeSubkeys
   * @returns {Record<string, boolean>}
   */
  const createExcludeSubkeysMap = (excludeSubkeys) => {
    return excludeSubkeys.reduce((result, item) => {
      result[`${item}.`] = true;
      return result;
    }, Object.create(null));
  };

  /**
   * @param {AnalysisOptionsInput | undefined} input
   * @returns {AnalysisOptionsInput}
   */
  const validateAnalysisOptions = (input) => {
    const source = ensureInputObject(input);
    /** @type {AnalysisOptionsInput} */
    const validated = {};

    if (hasOwn(source, 'query') && typeof source['query'] !== 'undefined') {
      validated.query = validateObjectOption('query', source['query']);
    }

    if (hasOwn(source, 'sort') && typeof source['sort'] !== 'undefined') {
      validated.sort = validateObjectOption('sort', source['sort']);
    }

    if (hasOwn(source, 'limit') && typeof source['limit'] !== 'undefined') {
      validated.limit = validateNonNegativeIntegerOption('limit', source['limit']);
    }

    if (hasOwn(source, 'maxDepth') && typeof source['maxDepth'] !== 'undefined') {
      validated.maxDepth = validateNonNegativeIntegerOption('maxDepth', source['maxDepth']);
    }

    if (hasOwn(source, 'outputFormat') && typeof source['outputFormat'] !== 'undefined') {
      validated.outputFormat = /** @type {string} */ (validateStringOption('outputFormat', source['outputFormat'], false, false));
    }

    if (hasOwn(source, 'maxExamples') && typeof source['maxExamples'] !== 'undefined') {
      validated.maxExamples = validateNonNegativeIntegerOption('maxExamples', source['maxExamples']);
    }

    if (hasOwn(source, 'lastValue') && typeof source['lastValue'] !== 'undefined') {
      validated.lastValue = validateBooleanOption('lastValue', source['lastValue']);
    }

    if (hasOwn(source, 'showArrayElements') && typeof source['showArrayElements'] !== 'undefined') {
      validated.showArrayElements = validateBooleanOption('showArrayElements', source['showArrayElements']);
    }

    if (hasOwn(source, 'compactArrayTypes') && typeof source['compactArrayTypes'] !== 'undefined') {
      validated.compactArrayTypes = validateBooleanOption('compactArrayTypes', source['compactArrayTypes']);
    }

    if (hasOwn(source, 'arrayEscape') && typeof source['arrayEscape'] !== 'undefined') {
      validated.arrayEscape = /** @type {string} */ (validateStringOption('arrayEscape', source['arrayEscape'], false, true));
    }

    if (hasOwn(source, 'excludeSubkeys') && typeof source['excludeSubkeys'] !== 'undefined') {
      validated.excludeSubkeys = validateStringArrayOption('excludeSubkeys', source['excludeSubkeys']);
    }

    if (hasOwn(source, 'logKeysContinuously') && typeof source['logKeysContinuously'] !== 'undefined') {
      validated.logKeysContinuously = validateBooleanOption('logKeysContinuously', source['logKeysContinuously']);
    }

    if (hasOwn(source, 'persistResults') && typeof source['persistResults'] !== 'undefined') {
      validated.persistResults = validateBooleanOption('persistResults', source['persistResults']);
    }

    if (hasOwn(source, 'resultsDatabase') && typeof source['resultsDatabase'] !== 'undefined') {
      validated.resultsDatabase = /** @type {string} */ (validateStringOption('resultsDatabase', source['resultsDatabase'], false, false));
    }

    if (hasOwn(source, 'resultsCollection') && typeof source['resultsCollection'] !== 'undefined') {
      validated.resultsCollection = /** @type {string} */ (validateStringOption('resultsCollection', source['resultsCollection'], false, false));
    }

    if (hasOwn(source, 'resultsUser') && typeof source['resultsUser'] !== 'undefined') {
      validated.resultsUser = validateStringOption('resultsUser', source['resultsUser'], true, false);
    }

    if (hasOwn(source, 'resultsPass') && typeof source['resultsPass'] !== 'undefined') {
      validated.resultsPass = validateStringOption('resultsPass', source['resultsPass'], true, false);
    }

    return validated;
  };

  /**
   * @param {AnalysisOptionsInput} validated
   * @returns {Record<string, unknown>}
   */
  const readQuery = (validated) => {
    return hasOwn(validated, 'query') ? /** @type {Record<string, unknown>} */ (validated.query) : {};
  };

  /**
   * @param {Record<string, unknown>} query
   * @param {AnalysisConfigContext | undefined} context
   * @returns {number}
   */
  const resolveDefaultLimit = (query, context) => {
    if (!context || typeof context.getDefaultLimit !== 'function') {
      throw new Error('getDefaultLimit context is required to derive the default limit.');
    }

    return validateNonNegativeIntegerOption('limit', context.getDefaultLimit(query));
  };

  /**
   * @param {AnalysisConfigContext | undefined} context
   * @returns {string}
   */
  const resolveDefaultResultsCollection = (context) => {
    if (!context || typeof context.collectionName !== 'string' || context.collectionName.length === 0) {
      throw new Error('collectionName context is required to derive the default resultsCollection.');
    }

    return `${context.collectionName}Keys`;
  };

  /**
   * @param {AnalysisOptionsInput | undefined} input
   * @param {AnalysisConfigContext} [context]
   * @returns {ResolvedAnalysisOptions}
   */
  const resolveAnalysisOptions = (input, context) => {
    const validated = validateAnalysisOptions(input);
    const query = readQuery(validated);

    return {
      arrayEscape: hasOwn(validated, 'arrayEscape') ? /** @type {string} */ (validated.arrayEscape) : 'XX',
      compactArrayTypes: hasOwn(validated, 'compactArrayTypes') ? /** @type {boolean} */ (validated.compactArrayTypes) : false,
      excludeSubkeys: hasOwn(validated, 'excludeSubkeys') ? /** @type {string[]} */ (validated.excludeSubkeys) : [],
      lastValue: hasOwn(validated, 'lastValue') ? /** @type {boolean} */ (validated.lastValue) : false,
      limit: hasOwn(validated, 'limit') ? /** @type {number} */ (validated.limit) : resolveDefaultLimit(query, context),
      logKeysContinuously: hasOwn(validated, 'logKeysContinuously') ? /** @type {boolean} */ (validated.logKeysContinuously) : false,
      maxDepth: hasOwn(validated, 'maxDepth') ? /** @type {number} */ (validated.maxDepth) : 99,
      maxExamples: hasOwn(validated, 'maxExamples') ? /** @type {number} */ (validated.maxExamples) : 0,
      outputFormat: hasOwn(validated, 'outputFormat') ? /** @type {string} */ (validated.outputFormat) : 'ascii',
      persistResults: hasOwn(validated, 'persistResults') ? /** @type {boolean} */ (validated.persistResults) : false,
      query,
      resultsCollection: hasOwn(validated, 'resultsCollection')
        ? /** @type {string} */ (validated.resultsCollection)
        : resolveDefaultResultsCollection(context),
      resultsDatabase: hasOwn(validated, 'resultsDatabase') ? /** @type {string} */ (validated.resultsDatabase) : 'varietyResults',
      resultsPass: hasOwn(validated, 'resultsPass') ? /** @type {string | null} */ (validated.resultsPass) : null,
      resultsUser: hasOwn(validated, 'resultsUser') ? /** @type {string | null} */ (validated.resultsUser) : null,
      showArrayElements: hasOwn(validated, 'showArrayElements') ? /** @type {boolean} */ (validated.showArrayElements) : false,
      sort: hasOwn(validated, 'sort') ? /** @type {Record<string, unknown>} */ (validated.sort) : { _id: -1 },
    };
  };

  /**
   * @param {AnalysisOptionsInput | ResolvedAnalysisOptions} value
   * @returns {ResolvedAnalysisOptions}
   */
  const ensureResolvedAnalysisOptions = (value) => {
    const resolved = ensureInputObject(value);
    if (ANALYSIS_OPTION_NAMES.some((name) => !hasOwn(resolved, name))) {
      throw new Error('Resolved analysis options are required before materialization.');
    }

    return /** @type {ResolvedAnalysisOptions} */ (resolved);
  };

  /**
   * @param {ResolvedAnalysisOptions} resolvedOptions
   * @returns {MaterializedAnalysisConfig}
   */
  const materializeAnalysisConfig = (resolvedOptions) => {
    const resolved = ensureResolvedAnalysisOptions(resolvedOptions);

    return {
      arrayEscape: resolved.arrayEscape,
      compactArrayTypes: resolved.compactArrayTypes,
      excludeSubkeys: createExcludeSubkeysMap(resolved.excludeSubkeys),
      lastValue: resolved.lastValue,
      limit: resolved.limit,
      logKeysContinuously: resolved.logKeysContinuously,
      maxDepth: resolved.maxDepth,
      maxExamples: resolved.maxExamples,
      outputFormat: resolved.outputFormat,
      persistResults: resolved.persistResults,
      query: cloneObject(resolved.query),
      resultsCollection: resolved.resultsCollection,
      resultsDatabase: resolved.resultsDatabase,
      resultsPass: resolved.resultsPass,
      resultsUser: resolved.resultsUser,
      showArrayElements: resolved.showArrayElements,
      sort: cloneObject(resolved.sort),
    };
  };

  const configApi = {
    ANALYSIS_OPTION_NAMES,
    materializeAnalysisConfig,
    resolveAnalysisOptions,
    validateAnalysisOptions,
  };

  root.__varietyConfig = configApi;

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = configApi;
  }
}(this));


// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// ENGINE SECTION
// =============================================================================
(function (shellContext) {
  'use strict';

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const createKeyMap = () => Object.create(null);

  const shellToJson = (value) => {
    if (typeof tojson === 'function') {
      return tojson(value);
    }

    if (shellContext.EJSON && typeof shellContext.EJSON.stringify === 'function') {
      return shellContext.EJSON.stringify(value);
    }

    return JSON.stringify(value);
  };

  const getBinDataSubtype = (binData) => {
    if (!binData) { return undefined; }
    if (typeof binData.subtype === 'function') {
      return binData.subtype();
    }
    if (typeof binData.sub_type !== 'undefined') {
      return binData.sub_type;
    }
    return undefined;
  };

  const getBinDataHex = (binData) => {
    if (binData && typeof binData.hex === 'function') {
      return binData.hex();
    }
    if (binData && typeof Buffer !== 'undefined' && binData.buffer) {
      return Buffer.from(binData.buffer).toString('hex');
    }
    return shellToJson(binData);
  };

  const getVectorDtypeByte = (binData) => {
    if (!binData) { return undefined; }
    if (typeof binData.hex === 'function') {
      const hex = binData.hex();
      if (typeof hex === 'string' && hex.length >= 2 && /^[0-9a-f]{2}/i.test(hex)) {
        return parseInt(hex.slice(0, 2), 16);
      }
      return undefined;
    }
    if (typeof Buffer !== 'undefined' && binData.buffer) {
      const buf = Buffer.from(binData.buffer);
      return buf.length > 0 ? buf[0] : undefined;
    }
    return undefined;
  };

  const getVectorDtypeLabel = (binData) => {
    const dtypeByte = getVectorDtypeByte(binData);
    if (typeof dtypeByte === 'undefined') {
      return 'BinData-vector[malformed]';
    }
    const dtypeAliases = {
      0x03: 'INT8',
      0x10: 'PACKED_BIT',
      0x27: 'FLOAT32',
    };
    const alias = dtypeAliases[dtypeByte];
    if (alias) {
      return `BinData-vector[${alias}]`;
    }
    return `BinData-vector[0x${dtypeByte.toString(16).padStart(2, '0')}]`;
  };

  const getRawBsonTypeName = (thing) => {
    if (!thing || typeof thing !== 'object') {
      return undefined;
    }

    if (typeof thing._bsontype === 'string') {
      return thing._bsontype;
    }

    if (thing.constructor && typeof thing.constructor.name === 'string') {
      return thing.constructor.name;
    }

    return undefined;
  };

  const normalizeBsonTypeName = (rawTypeName) => {
    const typeMap = {
      Binary: 'Binary',
      BinData: 'Binary',
      UUID: 'Binary',
      Long: 'NumberLong',
      NumberLong: 'NumberLong',
      ObjectId: 'ObjectId',
      Decimal128: 'Decimal128',
      NumberDecimal: 'Decimal128',
      Timestamp: 'Timestamp',
      Code: 'Code',
      RegExp: 'BSONRegExp',
      BSONRegExp: 'BSONRegExp',
      MinKey: 'MinKey',
      MaxKey: 'MaxKey',
      DBRef: 'DBRef',
      Double: 'Double',
      Int32: 'Int32',
      BSONSymbol: 'BSONSymbol',
    };

    return typeMap[rawTypeName];
  };

  const getSpecialTypeName = (thing) => {
    // Issue #164 (@vitorcampos-db): BSON wrappers like Decimal128 should not
    // fall through as plain Object values.
    const normalizedType = normalizeBsonTypeName(getRawBsonTypeName(thing));
    if (typeof normalizedType !== 'undefined') {
      return normalizedType;
    }

    if (typeof NumberLong !== 'undefined' && thing instanceof NumberLong) {
      return 'NumberLong';
    }

    if (typeof ObjectId !== 'undefined' && thing instanceof ObjectId) {
      return 'ObjectId';
    }

    if (typeof BinData !== 'undefined' && thing instanceof BinData) {
      return 'Binary';
    }

    return undefined;
  };

  // varietyTypeOf must remain a regular function (not an arrow function) because
  // the no-argument guard below relies on the function's own `arguments` object,
  // which arrow functions do not have.
  const varietyTypeOf = function(config, thing) {
    if (arguments.length < 2) { throw new Error('varietyTypeOf() requires an argument'); }

    if (typeof thing === 'undefined') {
      return 'undefined';
    } else if (typeof thing !== 'object') {
      // capitalize the first letter so the output matches the other return values. ―JC
      const typeofThing = typeof thing;
      return `${typeofThing[0].toUpperCase()}${typeofThing.slice(1)}`;
    } else {
      const specialType = getSpecialTypeName(thing);
      if (Array.isArray(thing)) {
        if (!config.compactArrayTypes) {
          return 'Array';
        }

        if (thing.length === 0) {
          return 'Array(empty)';
        }

        const seenElementTypes = Object.create(null);
        thing.forEach((item) => {
          seenElementTypes[varietyTypeOf(config, item)] = true;
        });

        return `Array(${Object.keys(seenElementTypes).sort().join('|')})`;
      } else if (thing === null) {
        return 'null';
      } else if (thing instanceof Date) {
        return 'Date';
      } else if (specialType === 'Binary') {
        const subtype = getBinDataSubtype(thing);
        if (subtype === 0x09) {
          return getVectorDtypeLabel(thing);
        }
        if (subtype >= 0x80) {
          return `BinData-user[0x${subtype.toString(16).padStart(2, '0')}]`;
        }
        if (subtype >= 0x0a) {
          return 'BinData-reserved';
        }
        const binDataTypes = {
          0x00: 'generic',
          0x01: 'function',
          0x02: 'old',
          0x03: 'UUID',
          0x04: 'UUID',
          0x05: 'MD5',
          0x06: 'encrypted',
          0x07: 'compressed-column',
          0x08: 'sensitive',
        };
        return `BinData-${binDataTypes[subtype]}`;
      } else if (typeof specialType !== 'undefined') {
        return specialType;
      } else {
        return 'Object';
      }
    }
  };

  // Flattens object keys to 1D. e.g. {'key1':1, 'key2':{'key3':2}} becomes {'key1':1, 'key2.key3':2}.
  // We assume no '.' characters in the keys, which is an OK assumption for MongoDB.
  const serializeDoc = (config, doc) => {
    const result = createKeyMap();

    // Recurse only into plain objects and arrays; BSON wrappers should stay scalar.
    const isHash = (v) => Array.isArray(v) || varietyTypeOf(config, v) === 'Object';

    const arrayRegex = new RegExp(`\\.${config.arrayEscape}\\d+${config.arrayEscape}\\.`, 'g');

    const serialize = (document, parentKey, depth) => {
      if (parentKey.replace(arrayRegex, '.') in config.excludeSubkeys) {
        return;
      }
      for (const key of Object.keys(document)) {
        const value = document[key];
        // Translate array index from {parent}.{index} to {parent}.arrayEscape{index}arrayEscape.
        const escapedKey = Array.isArray(document)
          ? `${config.arrayEscape}${key}${config.arrayEscape}`
          : key;
        result[`${parentKey}${escapedKey}`] = value;
        // Recurse into nested objects only if we have not reached max depth.
        if (isHash(value) && depth > 1) {
          serialize(value, `${parentKey}${escapedKey}.`, depth - 1);
        }
      }
    };
    serialize(doc, '', config.maxDepth);
    return result;
  };

  // Convert document to key-value map, where value is always an object with types as keys.
  const analyseDocument = (config, document) => {
    const result = createKeyMap();
    const arrayRegex = new RegExp(`\\.${config.arrayEscape}\\d+${config.arrayEscape}`, 'g');
    for (const rawKey of Object.keys(document)) {
      const value = document[rawKey];
      const key = rawKey.replace(arrayRegex, `.${config.arrayEscape}`);
      if (typeof result[key] === 'undefined') {
        result[key] = {};
      }
      const type = varietyTypeOf(config, value);
      result[key][type] = null;

      if (config.lastValue || config.maxExamples > 0) {
        if (type in {'String': true, 'Boolean': true}) {
          result[key][type] = value.toString();
        } else if (type in {'Number': true, 'NumberLong': true}) {
          result[key][type] = value.valueOf();
        } else if (type === 'ObjectId') {
          result[key][type] = typeof value.toHexString === 'function' ? value.toHexString() : value.str;
        } else if (type === 'Date') {
          result[key][type] = new Date(value).toISOString();
        } else if (type.startsWith('BinData')) {
          result[key][type] = getBinDataHex(value);
        }
      }
    }

    return result;
  };

  const mergeDocument = (config, docResult, interimResults, log) => {
    for (const key of Object.keys(docResult)) {
      if (key in interimResults) {
        const existing = interimResults[key];

        for (const type of Object.keys(docResult[key])) {
          if (type in existing.types) {
            existing.types[type] += 1;
          } else {
            existing.types[type] = 1;
            if (config.logKeysContinuously) {
              log(`Found new key type "${key}" type "${type}"`);
            }
          }
          if (config.maxExamples > 0 && existing.examples.length < config.maxExamples) {
            const rawVal = docResult[key][type];
            existing.examples.push(rawVal !== null ? rawVal : `[${type}]`);
          }
        }
        existing.totalOccurrences += 1;
      } else {
        let lastValue = null;
        let lastType = null;
        const types = createKeyMap();
        const examples = [];
        for (const newType of Object.keys(docResult[key])) {
          types[newType] = 1;
          lastValue = docResult[key][newType];
          lastType = newType;
          if (config.maxExamples > 0 && examples.length < config.maxExamples) {
            examples.push(lastValue !== null ? lastValue : `[${newType}]`);
          }
          if (config.logKeysContinuously) {
            log(`Found new key type "${key}" type "${newType}"`);
          }
        }
        interimResults[key] = {types, totalOccurrences: 1};
        if (config.lastValue) {
          interimResults[key].lastValue = lastValue ? lastValue : `[${lastType}]`;
        }
        if (config.maxExamples > 0) {
          interimResults[key].examples = examples;
        }
      }
    }
  };

  const convertResults = (config, interimResults, documentsCount) => {
    const varietyResults = [];
    for (const key of Object.keys(interimResults)) {
      const entry = interimResults[key];

      const obj = {
        _id: {key},
        value: {types: {...entry.types}},
        totalOccurrences: entry.totalOccurrences,
        percentContaining: entry.totalOccurrences * 100 / documentsCount,
      };

      if (config.lastValue) {
        obj.lastValue = entry.lastValue;
      }

      if (config.maxExamples > 0) {
        obj.examples = entry.examples;
      }

      varietyResults.push(obj);
    }
    return varietyResults;
  };

  const createAnalysisState = () => createKeyMap();

  // Merge the keys and types of current object into accumulator object.
  const ingestDocument = (config, accumulator, object, log) => {
    const docResult = analyseDocument(config, serializeDoc(config, object));
    mergeDocument(config, docResult, accumulator, log);
    return accumulator;
  };

  // By default, keys ending in an array index (e.g. "tags.XX") are suppressed,
  // since the parent key already captures the Array type. Set showArrayElements:true
  // to include them — useful for verifying element-type consistency within arrays.
  const buildResultFilter = (config) => {
    const arrayRegex = new RegExp(`\\.${config.arrayEscape}$`, 'g');
    return (item) => config.showArrayElements || !item._id.key.match(arrayRegex);
  };

  // Sort desc by totalOccurrences, or by key asc if occurrences are equal.
  const compareResults = (a, b) => {
    const countsDiff = b.totalOccurrences - a.totalOccurrences;
    return countsDiff !== 0 ? countsDiff : a._id.key.localeCompare(b._id.key);
  };

  const finalizeResults = (config, interimResults, documentsCount) => {
    return convertResults(config, interimResults, documentsCount)
      .filter(buildResultFilter(config))
      .sort(compareResults);
  };

  /**
   * @param {Record<string, unknown>} config
   * @param {Iterable<Record<string, unknown>>} documents
   * @param {{
   *   documentsCount?: number,
   *   log?: (message: string) => void
   * }} [options] When documentsCount is provided, percentContaining uses that
   * value instead of the number of iterated documents.
   */
  const analyzeDocuments = (config, documents, options) => {
    const analysisOptions = options || {};
    const log = typeof analysisOptions.log === 'function' ? analysisOptions.log : () => {};
    const interimResults = createAnalysisState();
    let documentsCount = 0;

    for (const document of documents) {
      ingestDocument(config, interimResults, document, log);
      documentsCount += 1;
    }

    if (typeof analysisOptions.documentsCount === 'number') {
      documentsCount = analysisOptions.documentsCount;
    }

    return finalizeResults(config, interimResults, documentsCount);
  };

  const engine = {
    createAnalysisState,
    createKeyMap,
    shellToJson,
    getBinDataSubtype,
    getBinDataHex,
    getVectorDtypeByte,
    getVectorDtypeLabel,
    getRawBsonTypeName,
    normalizeBsonTypeName,
    getSpecialTypeName,
    varietyTypeOf,
    serializeDoc,
    analyseDocument,
    mergeDocument,
    convertResults,
    ingestDocument,
    buildResultFilter,
    compareResults,
    finalizeResults,
    analyzeDocuments,
  };

  shellContext.__varietyEngine = engine;

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = engine;
  }
}(this));


// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// ANALYZER SECTION
// =============================================================================
(function (shellContext) {
  'use strict';

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const engine = shellContext.__varietyEngine ||
    (typeof module !== 'undefined' && module && module.exports && typeof require === 'function'
      ? require('./engine.js')
      : undefined);
  if (!engine) {
    throw new Error('Expected core/engine.js to register __varietyEngine.');
  }

  const persistResults = (config, varietyResults, deps) => {
    const {db, connect, log} = deps;

    const resultsCollectionName = config.resultsCollection;
    const resultsDB = !config.resultsDatabase.includes('/')
      // Local database; don't reconnect.
      ? db.getMongo().getDB(config.resultsDatabase)
      // Remote database, establish new connection.
      : connect(config.resultsDatabase);

    if (config.resultsUser !== null && config.resultsPass !== null) {
      resultsDB.auth(config.resultsUser, config.resultsPass);
    }

    // Replace results collection.
    log(`replacing results collection: ${resultsCollectionName}`);
    resultsDB.getCollection(resultsCollectionName).drop();
    resultsDB.getCollection(resultsCollectionName).insert(varietyResults);
  };

  const formatResults = (config, pluginsRunner, varietyResults, print) => {
    const formatterFactory = shellContext.__varietyFormatters[config.outputFormat];
    if (typeof formatterFactory !== 'function') {
      throw new Error(`Unknown outputFormat "${config.outputFormat}". Valid values are: ${Object.keys(shellContext.__varietyFormatters).join(', ')}.`);
    }
    const builtInFormatter = formatterFactory(config);

    const pluginsOutput = pluginsRunner.execute('formatResults', varietyResults);
    const outputs = pluginsOutput.length > 0 ? pluginsOutput : [builtInFormatter.formatResults(varietyResults)];
    outputs.forEach((output) => print(output));
  };

  // Orchestrates a Variety analysis from a parsed config and constructed
  // pluginsRunner, pulling every shell primitive it needs from `deps`.
  const run = (config, pluginsRunner, deps) => {
    const {db, connect, log, print, countMatchingDocuments} = deps;

    // limit(0) meant "no limit" in MongoDB ≤7 but is rejected by MongoDB 8+; guard against it.
    let cursor = db.getCollection(config.collection).find(config.query).sort(config.sort);
    if (config.limit > 0) { cursor = cursor.limit(config.limit); }
    const interimResults = engine.createAnalysisState();
    cursor.forEach((obj) => {
      // This shell-backed cursor already reflects mongosh/mongo BSON promotion,
      // so Double and Int32 arrive here as plain JavaScript numbers.
      engine.ingestDocument(config, interimResults, obj, log);
    });
    const varietyResults = engine.finalizeResults(
      config,
      interimResults,
      countMatchingDocuments(config.collection, config.query, config.limit)
    );

    if (config.persistResults) {
      persistResults(config, varietyResults, {db, connect, log});
    }

    formatResults(config, pluginsRunner, varietyResults, print);
  };

  const impl = Object.assign({}, engine, { run });
  shellContext.__varietyImpl = impl;

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = impl;
  }
}(this));


// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// INTERFACE SECTION
// =============================================================================
(function (shellContext) {
  'use strict'; // wraps everything for which we can use strict mode ―JC

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const configApi = shellContext.__varietyConfig ||
    (typeof module !== 'undefined' && module && module.exports && typeof require === 'function'
      ? require('../core/config.js')
      : undefined);
  if (!configApi) {
    throw new Error('Expected core/config.js to register __varietyConfig.');
  }

  const impl = shellContext.__varietyImpl;
  const {
    ANALYSIS_OPTION_NAMES,
    materializeAnalysisConfig,
    resolveAnalysisOptions,
  } = configApi;

  const shellIsQuiet = () => {
    if (typeof __quiet !== 'undefined' && __quiet) {
      return true;
    }

    return typeof process !== 'undefined' &&
      process &&
      process.argv &&
      process.argv.includes('--quiet');
  };

  const log = (message) => {
    if (!shellIsQuiet()) {
      print(message);
    }
  };

  const countMatchingDocuments = (collectionName, query, limit) => {
    const coll = db.getCollection(collectionName);
    const options = (typeof limit === 'number' && limit > 0) ? {limit} : undefined;
    return coll.countDocuments(query, options);
  };

  log('Variety: A MongoDB Schema Analyzer');
  log('Version 1.5.2, released 30 September 2025');

  if (typeof secondaryOk !== 'undefined') {
    if (secondaryOk === true) {
      db.getMongo().setReadPref('secondary');
    }
  }

  const selectedDatabaseName = db.getName();
  const knownDatabases = db.adminCommand('listDatabases').databases;
  const knownDatabaseNames = [];
  if (typeof knownDatabases !== 'undefined') { // not authorized user receives error response (json) without databases key
    // Keep validation scoped to the selected database. Issue #145
    // (@pkgajulapalli) hit a startup failure while enumerating collections for
    // an unrelated database.
    knownDatabases.forEach((database) => {
      if (typeof database.name === 'string' && database.name.length > 0) {
        knownDatabaseNames.push(database.name);
      }
    });

    if (!knownDatabaseNames.includes(selectedDatabaseName)) {
      throw new Error(`The database specified (${selectedDatabaseName}) does not exist.\n` +
          `Possible database options are: ${knownDatabaseNames.join(', ')}.`);
    }
  }

  const collectionNames = db.getCollectionNames();
  const collNames = collectionNames.join(', ');
  if (collectionNames.length === 0) {
    throw new Error(`The database specified (${selectedDatabaseName}) is empty.\n` +
        `Possible database options are: ${knownDatabaseNames.join(', ')}.`);
  }

  if (typeof collection === 'undefined') {
    throw new Error('You have to supply a \'collection\' variable, à la --eval \'var collection = "animals"\'.\n' +
        `Possible collection options for database specified: ${collNames}.\n` +
        'Please see https://github.com/variety/variety for details.');
  }

  if (countMatchingDocuments(collection, {}) === 0) {
    throw new Error(`The collection specified (${collection}) in the database specified (${db.getName()}) does not exist or is empty.\n` +
        `Possible collection options for database specified: ${collNames}.`);
  }

  const resolvedOptions = resolveAnalysisOptions(shellContext, {
    collectionName: collection,
    getDefaultLimit(query) {
      return countMatchingDocuments(collection, query);
    },
  });

  log(`Using collection of ${impl.shellToJson(collection)}`);
  ANALYSIS_OPTION_NAMES.forEach((name) => {
    log(`Using ${name} of ${impl.shellToJson(resolvedOptions[name])}`);
  });

  const config = Object.assign({ collection }, materializeAnalysisConfig(resolvedOptions));

  const createPluginsRunner = (context) => {
    const parsePath = (val) => val.slice(-3) !== '.js' ? `${val}.js` : val;
    const parseConfig = (val) => {
      const cfg = {};
      val.split('&').reduce((acc, entry) => {
        const parts = entry.split('=');
        acc[parts[0]] = parts[1];
        return acc;
      }, cfg);
      return cfg;
    };

    const plugins = typeof context.plugins !== 'undefined'
      ? context.plugins.split(',')
        .map((p) => p.trim())
        .map((definition) => {
          const path = parsePath(definition.split('|')[0]);
          const cfg = parseConfig(definition.split('|')[1] || '');
          context.module = {exports: {}};
          load(path);
          const plugin = context.module.exports;
          delete context.module;
          plugin.path = path;
          if (typeof plugin.init === 'function') {
            plugin.init(cfg);
          }
          return plugin;
        })
      : [];

    log(`Using plugins of ${impl.shellToJson(plugins.map((plugin) => plugin.path))}`);

    return {
      execute(methodName, ...args) {
        const applicablePlugins = plugins.filter((plugin) => typeof plugin[methodName] === 'function');
        return applicablePlugins.map((plugin) => plugin[methodName](...args));
      }
    };
  };

  const pluginsRunner = createPluginsRunner(shellContext);
  pluginsRunner.execute('onConfig', config);

  impl.run(config, pluginsRunner, {
    db,
    connect: typeof connect !== 'undefined' ? connect : undefined,
    log,
    print,
    countMatchingDocuments,
  });

  // Clean up the implementation handoffs so repeated loads remain idempotent
  // and no ad hoc internals leak onto globalThis after execution.
  delete shellContext.__varietyConfig;
  delete shellContext.__varietyEngine;
  delete shellContext.__varietyImpl;
  delete shellContext.__varietyFormatters;
}(this)); // end strict mode
