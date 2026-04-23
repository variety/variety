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
   *   materializeAnalysisConfig: (resolvedOptions: AnalysisOptionsInput | ResolvedAnalysisOptions) => MaterializedAnalysisConfig,
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
   * @param {AnalysisOptionsInput | ResolvedAnalysisOptions} resolvedOptions
   * @returns {MaterializedAnalysisConfig}
   */
  const materializeAnalysisConfig = (resolvedOptions) => {
    const validated = validateAnalysisOptions(resolvedOptions);
    if (!hasOwn(validated, 'query') || !hasOwn(validated, 'sort') || !hasOwn(validated, 'limit') ||
      !hasOwn(validated, 'maxDepth') || !hasOwn(validated, 'outputFormat') || !hasOwn(validated, 'maxExamples') ||
      !hasOwn(validated, 'lastValue') || !hasOwn(validated, 'showArrayElements') ||
      !hasOwn(validated, 'compactArrayTypes') || !hasOwn(validated, 'arrayEscape') ||
      !hasOwn(validated, 'excludeSubkeys') || !hasOwn(validated, 'logKeysContinuously') ||
      !hasOwn(validated, 'persistResults') || !hasOwn(validated, 'resultsDatabase') ||
      !hasOwn(validated, 'resultsCollection') || !hasOwn(validated, 'resultsUser') ||
      !hasOwn(validated, 'resultsPass')) {
      throw new Error('Resolved analysis options are required before materialization.');
    }

    return {
      arrayEscape: /** @type {string} */ (validated.arrayEscape),
      compactArrayTypes: /** @type {boolean} */ (validated.compactArrayTypes),
      excludeSubkeys: createExcludeSubkeysMap(/** @type {string[]} */ (validated.excludeSubkeys)),
      lastValue: /** @type {boolean} */ (validated.lastValue),
      limit: /** @type {number} */ (validated.limit),
      logKeysContinuously: /** @type {boolean} */ (validated.logKeysContinuously),
      maxDepth: /** @type {number} */ (validated.maxDepth),
      maxExamples: /** @type {number} */ (validated.maxExamples),
      outputFormat: /** @type {string} */ (validated.outputFormat),
      persistResults: /** @type {boolean} */ (validated.persistResults),
      query: /** @type {Record<string, unknown>} */ (validated.query),
      resultsCollection: /** @type {string} */ (validated.resultsCollection),
      resultsDatabase: /** @type {string} */ (validated.resultsDatabase),
      resultsPass: /** @type {string | null} */ (validated.resultsPass),
      resultsUser: /** @type {string | null} */ (validated.resultsUser),
      showArrayElements: /** @type {boolean} */ (validated.showArrayElements),
      sort: /** @type {Record<string, unknown>} */ (validated.sort),
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
