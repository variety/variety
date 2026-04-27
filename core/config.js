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
   *   hideFrequencyColumns?: boolean,
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
   *   hideFrequencyColumns: boolean,
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
   * @typedef {'boolean' | 'nonNegativeInteger' | 'object' | 'string' | 'stringArray'} OptionKind
   */

  /**
   * @typedef {{
   *   name: string,
   *   kind: OptionKind,
   *   allowNull?: boolean,
   *   requireNonEmpty?: boolean,
   * }} OptionDescriptor
   */

  /**
   * @typedef {{
   *   validateOptions: (source: Record<string, unknown>, descriptors: OptionDescriptor[]) => Record<string, unknown>,
   * }} OptionValidationApi
   */

  /**
   * @typedef {{
   *   ANALYSIS_OPTION_NAMES: AnalysisOptionName[],
   *   materializeAnalysisConfig: (resolvedOptions: ResolvedAnalysisOptions) => MaterializedAnalysisConfig,
   *   resolveAnalysisOptions: (input: AnalysisOptionsInput | undefined, context?: AnalysisConfigContext) => ResolvedAnalysisOptions,
   *   validateAnalysisOptions: (input: AnalysisOptionsInput | undefined) => AnalysisOptionsInput,
   * }} VarietyConfigApi
   */

  const root = /** @type {typeof globalThis & { __varietyConfig?: VarietyConfigApi, __varietyOptionValidation?: OptionValidationApi }} */ (
    typeof globalThis !== 'undefined' ? globalThis : shellContext
  );

  /** @type {OptionValidationApi | undefined} */
  const optionValidation = root.__varietyOptionValidation ||
    (typeof module !== 'undefined' && module && module.exports && typeof require === 'function'
      ? /** @type {OptionValidationApi} */ (require('./option-validation.js'))
      : undefined);
  if (!optionValidation) {
    throw new Error('Expected core/option-validation.js to register __varietyOptionValidation.');
  }
  const { validateOptions } = optionValidation;

  /**
   * @param {object} value
   * @param {string} key
   * @returns {boolean}
   */
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  /** @type {OptionDescriptor[]} */
  const ANALYSIS_OPTION_DESCRIPTORS = [
    { name: 'query',               kind: 'object' },
    { name: 'limit',               kind: 'nonNegativeInteger' },
    { name: 'maxDepth',            kind: 'nonNegativeInteger' },
    { name: 'sort',                kind: 'object' },
    { name: 'outputFormat',        kind: 'string',      allowNull: false, requireNonEmpty: false },
    { name: 'hideFrequencyColumns',kind: 'boolean' },
    { name: 'persistResults',      kind: 'boolean' },
    { name: 'resultsDatabase',     kind: 'string',      allowNull: false, requireNonEmpty: false },
    { name: 'resultsCollection',   kind: 'string',      allowNull: false, requireNonEmpty: false },
    { name: 'resultsUser',         kind: 'string',      allowNull: true,  requireNonEmpty: false },
    { name: 'resultsPass',         kind: 'string',      allowNull: true,  requireNonEmpty: false },
    { name: 'logKeysContinuously', kind: 'boolean' },
    { name: 'excludeSubkeys',      kind: 'stringArray' },
    { name: 'arrayEscape',         kind: 'string',      allowNull: false, requireNonEmpty: true },
    { name: 'showArrayElements',   kind: 'boolean' },
    { name: 'compactArrayTypes',   kind: 'boolean' },
    { name: 'lastValue',           kind: 'boolean' },
    { name: 'maxExamples',         kind: 'nonNegativeInteger' },
  ];

  /** @type {AnalysisOptionName[]} */
  const ANALYSIS_OPTION_NAMES = ANALYSIS_OPTION_DESCRIPTORS.map((d) => /** @type {AnalysisOptionName} */ (d.name));

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
    return /** @type {AnalysisOptionsInput} */ (validateOptions(source, ANALYSIS_OPTION_DESCRIPTORS));
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
      hideFrequencyColumns: hasOwn(validated, 'hideFrequencyColumns')
        ? /** @type {boolean} */ (validated.hideFrequencyColumns)
        : false,
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
      hideFrequencyColumns: resolved.hideFrequencyColumns,
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
