// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
'use strict';

const path = require('path');
const varietyConfigModule = /** @type {typeof import('../core/config.js')} */ (require('../core/config.js'));
const {
  ANALYSIS_OPTION_NAMES,
  validateAnalysisOptions,
} = varietyConfigModule;
const transportOptionsModule = /** @type {typeof import('../mongo-shell/transport-options.js')} */ (require('../mongo-shell/transport-options.js'));
const { validateShellOptions } = transportOptionsModule;

/** @typedef {import('../mongo-shell/transport-options.js').ShellOptions} ShellOptions */

/** @typedef {NonNullable<Parameters<typeof validateAnalysisOptions>[0]>} AnalysisOptionsInput */

/** @typedef {{ secondaryOk?: boolean }} ShellRuntimeOptions */

/**
 * @typedef {{
 *   collection: string,
 *   database: string,
 * }} TargetSelection
 */

/**
 * @typedef {{
 *   extraEval: string[],
 *   help?: boolean,
 *   pluginEntries: string[],
 *   runtimeOptions: ShellRuntimeOptions,
 *   shellOptions: ShellOptions,
 *   target: TargetSelection | null,
 *   varietyOptions: AnalysisOptionsInput,
 *   version?: boolean,
 * }} ParsedCliArguments
 */

/** @typedef {{ mode: 'help' }} HelpExecutionPlan */
/** @typedef {{ mode: 'version' }} VersionExecutionPlan */

/**
 * @typedef {{
 *   database: string,
 *   evalCode: string,
 *   mode: 'cli' | 'compatibility',
 *   scriptPath: string,
 *   shellOptions: ShellOptions,
 * }} RunnableExecutionPlan
 */

/** @typedef {HelpExecutionPlan | VersionExecutionPlan | RunnableExecutionPlan} ExecutionPlan */

/**
 * @typedef {{
 *   nextIndex: number,
 *   value: string,
 * }} ReadOptionValueResult
 */

class CliUsageError extends Error {
  /**
   * @param {string} message
   * @param {number} [exitCode=2]
   */
  constructor(message, exitCode = 2) {
    super(message);
    this.name = 'CliUsageError';
    this.exitCode = exitCode;
  }
}

const COMPATIBILITY_ENV_KEYS = ['DB', 'EVAL_CMDS', 'VARIETYJS_DIR'];
const MONGODB_URI_PREFIXES = ['mongodb://', 'mongodb+srv://'];
/** @type {Record<string, string>} */
const FLAG_ALIASES = {
  'array-escape': 'arrayEscape',
  'authentication-database': 'authenticationDatabase',
  'last-value': 'lastValue',
  'compact-array-types': 'compactArrayTypes',
  'exclude-subkeys': 'excludeSubkeys',
  'hide-frequency-columns': 'hideFrequencyColumns',
  'log-keys-continuously': 'logKeysContinuously',
  'max-depth': 'maxDepth',
  'max-examples': 'maxExamples',
  'output-format': 'outputFormat',
  'persist-results': 'persistResults',
  'results-collection': 'resultsCollection',
  'results-database': 'resultsDatabase',
  'results-password': 'resultsPass',
  'results-user': 'resultsUser',
  'secondary-ok': 'secondaryOk',
  'show-array-elements': 'showArrayElements',
};
const KNOWN_OPTION_NAMES = new Set([
  ...ANALYSIS_OPTION_NAMES,
  'authenticationDatabase',
  'eval',
  'help',
  'host',
  'password',
  'plugin',
  'port',
  'quiet',
  'secondaryOk',
  'uri',
  'username',
  'version',
]);

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
const hasCompatibilityEnv = (env) => {
  return COMPATIBILITY_ENV_KEYS.some((key) => typeof env[key] !== 'undefined');
};

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
const resolveCompatibilityScriptPath = (env) => {
  const varietyJsDir = env['VARIETYJS_DIR'];
  if (varietyJsDir) {
    return path.join(varietyJsDir, 'variety.js');
  }

  return './variety.js';
};

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
const resolveCliScriptPath = (env) => {
  const varietyJsDir = env['VARIETYJS_DIR'];
  if (varietyJsDir) {
    return path.join(varietyJsDir, 'variety.js');
  }

  return path.resolve(__dirname, '..', 'variety.js');
};

/**
 * @param {string | undefined} value
 * @returns {string}
 */
const stripMatchingOuterQuotes = (value) => {
  if (typeof value !== 'string' || value.length < 2) {
    return value || '';
  }

  const firstChar = value[0];
  const lastChar = value[value.length - 1];
  if ((firstChar === '"' || firstChar === '\'') && firstChar === lastChar) {
    return value.slice(1, -1);
  }

  return value;
};

/**
 * @param {string} optionName
 * @param {string} rawValue
 * @returns {number}
 */
const parseNonNegativeInteger = (optionName, rawValue) => {
  if (!/^\d+$/.test(rawValue)) {
    throw new CliUsageError(`--${optionName} must be a non-negative integer, received ${JSON.stringify(rawValue)}.`);
  }

  const numericValue = Number(rawValue);
  if (!Number.isSafeInteger(numericValue)) {
    throw new CliUsageError(`--${optionName} is too large: ${rawValue}.`);
  }

  return numericValue;
};

/**
 * @param {string} optionName
 * @param {string} rawValue
 * @returns {number}
 */
const parsePositiveInteger = (optionName, rawValue) => {
  const numericValue = parseNonNegativeInteger(optionName, rawValue);
  if (numericValue < 1) {
    throw new CliUsageError(`--${optionName} must be a positive integer, received ${JSON.stringify(rawValue)}.`);
  }

  return numericValue;
};

/**
 * @param {string} optionName
 * @param {string | undefined} rawValue
 * @returns {boolean}
 */
const parseBooleanValue = (optionName, rawValue) => {
  if (typeof rawValue === 'undefined') {
    return true;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new CliUsageError(`--${optionName} accepts only true or false when given a value.`);
};

/**
 * @param {string} optionName
 * @param {string} rawValue
 * @returns {Record<string, unknown>}
 */
const parseJsonObject = (optionName, rawValue) => {
  /** @type {unknown} */
  let parsedValue;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CliUsageError(`--${optionName} must be strict JSON. ${errorMessage}`);
  }

  if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== 'object') {
    throw new CliUsageError(`--${optionName} must be a JSON object.`);
  }

  return /** @type {Record<string, unknown>} */ (parsedValue);
};

/**
 * @param {string} optionName
 * @param {string} rawValue
 * @returns {string}
 */
const parseNonEmptyString = (optionName, rawValue) => {
  if (rawValue.length === 0) {
    throw new CliUsageError(`--${optionName} must not be empty.`);
  }

  return rawValue;
};

/**
 * @param {string} optionName
 * @param {string} rawValue
 * @returns {string}
 */
const parseMongoUri = (optionName, rawValue) => {
  const value = parseNonEmptyString(optionName, rawValue);
  if (!MONGODB_URI_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    throw new CliUsageError(`--${optionName} must start with "mongodb://" or "mongodb+srv://".`);
  }

  return value;
};

/**
 * @param {string} rawOptionName
 * @returns {string}
 */
const normalizeOptionName = (rawOptionName) => {
  return FLAG_ALIASES[rawOptionName] || rawOptionName;
};

/**
 * @param {string} value
 * @returns {boolean}
 */
const isKnownOptionToken = (value) => {
  if (!value.startsWith('--')) {
    return false;
  }

  const rawOptionName = value.slice(2).split('=', 2)[0] || '';
  return rawOptionName.length > 0 && KNOWN_OPTION_NAMES.has(normalizeOptionName(rawOptionName));
};

/**
 * @param {string[]} argv
 * @param {number} currentIndex
 * @param {string | undefined} inlineValue
 * @param {string} optionName
 * @returns {ReadOptionValueResult}
 */
const readOptionValue = (argv, currentIndex, inlineValue, optionName) => {
  if (typeof inlineValue !== 'undefined') {
    return { nextIndex: currentIndex, value: inlineValue };
  }

  const nextValue = argv[currentIndex + 1];
  if (typeof nextValue !== 'string' || nextValue.startsWith('--')) {
    throw new CliUsageError(`--${optionName} requires a value.`);
  }

  return {
    nextIndex: currentIndex + 1,
    value: nextValue,
  };
};

/**
 * @param {string[]} argv
 * @param {number} currentIndex
 * @param {string | undefined} inlineValue
 * @returns {ReadOptionValueResult}
 */
const readEvalValue = (argv, currentIndex, inlineValue) => {
  if (typeof inlineValue !== 'undefined') {
    return { nextIndex: currentIndex, value: inlineValue };
  }

  const nextValue = argv[currentIndex + 1];
  if (typeof nextValue !== 'string') {
    throw new CliUsageError('--eval requires a value.');
  }

  if (isKnownOptionToken(nextValue)) {
    throw new CliUsageError(
      `--eval expected JavaScript, but received Variety CLI flag ${JSON.stringify(nextValue)}. ` +
      'If you meant the flag, place it before --eval. ' +
      `If you meant literal JavaScript starting with --, use --eval=${nextValue}.`
    );
  }

  return {
    nextIndex: currentIndex + 1,
    value: nextValue,
  };
};

/**
 * @param {string} rawTarget
 * @returns {TargetSelection}
 */
const parseTarget = (rawTarget) => {
  const separatorIndex = rawTarget.indexOf('/');
  if (separatorIndex <= 0 || separatorIndex === rawTarget.length - 1) {
    throw new CliUsageError('Expected DB/COLLECTION as the positional target.');
  }

  return {
    collection: rawTarget.slice(separatorIndex + 1),
    database: rawTarget.slice(0, separatorIndex),
  };
};

/**
 * @typedef {{
 *   beforePath: string,
 *   database: string | null,
 *   suffix: string,
 * }} ParsedMongoUri
 */

/**
 * @param {string} rawUri
 * @returns {ParsedMongoUri}
 */
const parseMongoUriParts = (rawUri) => {
  const authorityStart = rawUri.indexOf('://') + 3;
  const queryIndex = rawUri.indexOf('?', authorityStart);
  const fragmentIndex = rawUri.indexOf('#', authorityStart);
  let suffixStart = rawUri.length;
  if (queryIndex !== -1 && queryIndex < suffixStart) {
    suffixStart = queryIndex;
  }
  if (fragmentIndex !== -1 && fragmentIndex < suffixStart) {
    suffixStart = fragmentIndex;
  }

  const pathStart = rawUri.indexOf('/', authorityStart);
  if (pathStart === -1 || pathStart >= suffixStart) {
    return {
      beforePath: rawUri.slice(0, suffixStart),
      database: null,
      suffix: rawUri.slice(suffixStart),
    };
  }

  const rawDatabase = rawUri.slice(pathStart + 1, suffixStart);
  if (rawDatabase.length === 0) {
    return {
      beforePath: rawUri.slice(0, pathStart),
      database: null,
      suffix: rawUri.slice(suffixStart),
    };
  }

  try {
    return {
      beforePath: rawUri.slice(0, pathStart),
      database: decodeURIComponent(rawDatabase),
      suffix: rawUri.slice(suffixStart),
    };
  } catch {
    throw new CliUsageError('--uri contains an invalid percent-encoded database path.');
  }
};

/**
 * @param {string} rawUri
 * @param {TargetSelection} target
 * @returns {string}
 */
const resolveMongoUriForTarget = (rawUri, target) => {
  const parsedUri = parseMongoUriParts(rawUri);
  if (parsedUri.database === null) {
    return `${parsedUri.beforePath}/${encodeURIComponent(target.database)}${parsedUri.suffix}`;
  }

  if (parsedUri.database !== target.database) {
    throw new CliUsageError(`--uri database ${JSON.stringify(parsedUri.database)} does not match positional DB ${JSON.stringify(target.database)}.`);
  }

  return rawUri;
};

/**
 * @param {ShellOptions} shellOptions
 * @param {TargetSelection} target
 * @returns {ShellOptions}
 */
const resolveShellOptions = (shellOptions, target) => {
  /** @type {ShellOptions} */
  const resolved = { ...shellOptions };

  if (typeof resolved.uri === 'undefined') {
    return resolved;
  }

  resolved.uri = resolveMongoUriForTarget(resolved.uri, target);
  return resolved;
};

/**
 * @param {string[]} argv
 * @returns {ParsedCliArguments}
 */
const parseCliArguments = (argv) => {
  /** @type {ParsedCliArguments} */
  const parsed = {
    extraEval: [],
    pluginEntries: [],
    runtimeOptions: {},
    shellOptions: {},
    target: null,
    varietyOptions: {},
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (typeof argument !== 'string') {
      throw new CliUsageError(`Unexpected missing CLI argument at index ${index}.`);
    }

    if (!argument.startsWith('--')) {
      if (parsed.target !== null) {
        throw new CliUsageError(`Unexpected extra positional argument ${JSON.stringify(argument)}.`);
      }

      parsed.target = parseTarget(argument);
      continue;
    }

    const [rawOptionName, inlineValue] = argument.slice(2).split('=', 2);
    if (typeof rawOptionName !== 'string' || rawOptionName.length === 0) {
      throw new CliUsageError(`Unknown option ${JSON.stringify(argument)}.`);
    }
    const optionName = normalizeOptionName(rawOptionName);

    switch (optionName) {
    case 'help':
      parsed.help = parseBooleanValue(optionName, inlineValue);
      break;
    case 'version':
      parsed.version = parseBooleanValue(optionName, inlineValue);
      break;
    case 'quiet':
      parsed.shellOptions.quiet = parseBooleanValue(optionName, inlineValue);
      break;
    case 'query': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.query = parseJsonObject(optionName, result.value);
      break;
    }
    case 'sort': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.sort = parseJsonObject(optionName, result.value);
      break;
    }
    case 'limit': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.limit = parseNonNegativeInteger(optionName, result.value);
      break;
    }
    case 'maxDepth': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.maxDepth = parseNonNegativeInteger(optionName, result.value);
      break;
    }
    case 'maxExamples': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.maxExamples = parseNonNegativeInteger(optionName, result.value);
      break;
    }
    case 'outputFormat': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.outputFormat = result.value;
      break;
    }
    case 'hideFrequencyColumns':
      parsed.varietyOptions.hideFrequencyColumns = parseBooleanValue(optionName, inlineValue);
      break;
    case 'lastValue':
      parsed.varietyOptions.lastValue = parseBooleanValue(optionName, inlineValue);
      break;
    case 'secondaryOk':
      parsed.runtimeOptions.secondaryOk = parseBooleanValue(optionName, inlineValue);
      break;
    case 'showArrayElements':
      parsed.varietyOptions.showArrayElements = parseBooleanValue(optionName, inlineValue);
      break;
    case 'compactArrayTypes':
      parsed.varietyOptions.compactArrayTypes = parseBooleanValue(optionName, inlineValue);
      break;
    case 'logKeysContinuously':
      parsed.varietyOptions.logKeysContinuously = parseBooleanValue(optionName, inlineValue);
      break;
    case 'persistResults':
      parsed.varietyOptions.persistResults = parseBooleanValue(optionName, inlineValue);
      break;
    case 'resultsDatabase': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.resultsDatabase = result.value;
      break;
    }
    case 'resultsCollection': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.resultsCollection = result.value;
      break;
    }
    case 'resultsUser': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.resultsUser = result.value;
      break;
    }
    case 'resultsPass': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.resultsPass = result.value;
      break;
    }
    case 'arrayEscape': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.arrayEscape = parseNonEmptyString(optionName, result.value);
      break;
    }
    case 'excludeSubkeys': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      if (!parsed.varietyOptions.excludeSubkeys) {
        parsed.varietyOptions.excludeSubkeys = [];
      }
      parsed.varietyOptions.excludeSubkeys.push(result.value);
      break;
    }
    case 'host': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.shellOptions.host = result.value;
      break;
    }
    case 'username': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.shellOptions.username = result.value;
      break;
    }
    case 'password': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.shellOptions.password = result.value;
      break;
    }
    case 'authenticationDatabase': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.shellOptions.authenticationDatabase = result.value;
      break;
    }
    case 'uri': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.shellOptions.uri = parseMongoUri(optionName, result.value);
      break;
    }
    case 'port': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.shellOptions.port = parsePositiveInteger(optionName, result.value);
      break;
    }
    case 'eval': {
      const result = readEvalValue(argv, index, inlineValue);
      index = result.nextIndex;
      parsed.extraEval.push(result.value);
      break;
    }
    case 'plugin': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.pluginEntries.push(result.value);
      break;
    }
    default:
      throw new CliUsageError(`Unknown option --${rawOptionName}.`);
    }
  }

  if (!parsed.help && !parsed.version && parsed.target === null) {
    throw new CliUsageError('Missing required DB/COLLECTION target.');
  }

  try {
    parsed.varietyOptions = validateAnalysisOptions(parsed.varietyOptions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CliUsageError(errorMessage);
  }

  try {
    parsed.shellOptions = validateShellOptions(parsed.shellOptions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CliUsageError(errorMessage);
  }

  return parsed;
};

/**
 * @param {string} name
 * @param {unknown} value
 * @returns {string}
 */
const renderVarAssignment = (name, value) => {
  return `var ${name} = ${JSON.stringify(value)}`;
};

/**
 * @param {ParsedCliArguments} parsedCliArguments
 * @returns {string}
 */
const buildEvalCode = (parsedCliArguments) => {
  if (parsedCliArguments.target === null) {
    return '';
  }

  const statements = [renderVarAssignment('collection', parsedCliArguments.target.collection)];
  ANALYSIS_OPTION_NAMES.forEach((name) => {
    if (Object.hasOwn(parsedCliArguments.varietyOptions, name)) {
      statements.push(renderVarAssignment(name, parsedCliArguments.varietyOptions[name]));
    }
  });
  if (Object.hasOwn(parsedCliArguments.runtimeOptions, 'secondaryOk')) {
    statements.push(renderVarAssignment('secondaryOk', parsedCliArguments.runtimeOptions.secondaryOk));
  }

  if (parsedCliArguments.pluginEntries.length > 0) {
    const pluginsValue = parsedCliArguments.pluginEntries
      .map((entry) => entry.replace('?', '|'))
      .join(',');
    statements.push(renderVarAssignment('plugins', pluginsValue));
  }

  return statements.concat(parsedCliArguments.extraEval).join('; ');
};

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {RunnableExecutionPlan}
 */
const createCompatibilityPlan = (env) => {
  return {
    database: env['DB'] || '',
    evalCode: stripMatchingOuterQuotes(env['EVAL_CMDS'] || ''),
    mode: 'compatibility',
    scriptPath: resolveCompatibilityScriptPath(env),
    shellOptions: {},
  };
};

/**
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} env
 * @returns {ExecutionPlan}
 */
const createCliPlan = (argv, env) => {
  const parsedCliArguments = parseCliArguments(argv);
  if (parsedCliArguments.help) {
    return { mode: 'help' };
  }

  if (parsedCliArguments.version) {
    return { mode: 'version' };
  }

  if (parsedCliArguments.target === null) {
    throw new CliUsageError('Missing required DB/COLLECTION target.');
  }

  return {
    database: parsedCliArguments.target.database,
    evalCode: buildEvalCode(parsedCliArguments),
    mode: 'cli',
    scriptPath: resolveCliScriptPath(env),
    shellOptions: resolveShellOptions(parsedCliArguments.shellOptions, parsedCliArguments.target),
  };
};

/**
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} env
 * @returns {ExecutionPlan}
 */
const createExecutionPlan = (argv, env) => {
  if (argv.length === 0) {
    if (hasCompatibilityEnv(env)) {
      return createCompatibilityPlan(env);
    }

    throw new CliUsageError('Missing required DB/COLLECTION target.');
  }

  return createCliPlan(argv, env);
};

/**
 * @returns {string}
 */
const formatUsage = () => {
  return [
    'Usage:',
    '  variety DB/COLLECTION [options]',
    '  DB=test EVAL_CMDS=\'var collection = "users"\' variety',
    '',
    'Options:',
    '  --query <json>                   Strict JSON query object',
    '  --sort <json>                    Strict JSON sort object',
    '  --limit <number>                 Limit documents analyzed',
    '  --maxDepth <number>              Maximum traversal depth',
    '  --maxExamples <number>           Number of example values to collect per key',
    '  --lastValue                      Capture one representative value per key',
    '  --secondary-ok                   Read from a secondary by setting read preference',
    '  --outputFormat <value>           Output format, e.g. ascii or json',
    '  --hideFrequencyColumns           Hide the occurrences and percents columns in ASCII output',
    '  --showArrayElements              Include array element keys in output',
    '  --compactArrayTypes              Render Array(Type) instead of plain Array',
    '  --arrayEscape <value>            Custom escape for array index keys (default XX)',
    '  --excludeSubkeys <path>          Dot-path to skip; repeat to exclude multiple',
    '  --logKeysContinuously            Stream keys as they arrive',
    '  --persistResults                 Write results to MongoDB instead of stdout',
    '  --resultsDatabase <value>        Target DB for persisted results (name or host:port/db)',
    '  --resultsCollection <value>      Target collection for persisted results',
    '  --results-user <value>           MongoDB username for results database',
    '  --results-password <value>       MongoDB password for results database',
    '  --quiet                          Pass --quiet through to the Mongo shell',
    '  --host <value>                   Mongo shell host',
    '  --port <number>                  Mongo shell port',
    '  --uri <mongodb-uri>              MongoDB connection string for the shell target',
    '  --username <value>               MongoDB username',
    '  --password <value>               MongoDB password',
    '  --authenticationDatabase <value> Authentication database',
    '  --plugin <path[?cfg]>            Plugin file to load; repeat for multiple plugins',
    '  --eval <javascript>              Extra JavaScript appended after CLI assignments',
    '                                   Use --eval=... when the code starts with --',
    '  --help                           Show this help',
    '  --version                        Show the Variety package version',
    '',
    'With no CLI arguments, the documented DB / EVAL_CMDS / VARIETYJS_DIR',
    'environment variables remain supported for backwards compatibility.',
  ].join('\n');
};

module.exports = {
  CliUsageError,
  buildEvalCode,
  createExecutionPlan,
  formatUsage,
  hasCompatibilityEnv,
  parseCliArguments,
  stripMatchingOuterQuotes,
};
