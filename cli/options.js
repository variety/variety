// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
'use strict';

const path = require('path');

/**
 * @typedef {{
 *   authenticationDatabase?: string,
 *   host?: string,
 *   password?: string,
 *   port?: number,
 *   quiet?: boolean,
 *   username?: string,
 * }} ShellOptions
 */

/**
 * @typedef {{
 *   limit?: number,
 *   maxDepth?: number,
 *   outputFormat?: string,
 *   query?: Record<string, unknown>,
 *   sort?: Record<string, unknown>,
 * }} VarietyOptions
 */

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
 *   shellOptions: ShellOptions,
 *   target: TargetSelection | null,
 *   varietyOptions: VarietyOptions,
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
/** @type {Array<keyof VarietyOptions>} */
const TARGET_OPTION_NAMES = ['query', 'sort', 'limit', 'maxDepth', 'outputFormat'];
/** @type {Record<string, string>} */
const FLAG_ALIASES = {
  'authentication-database': 'authenticationDatabase',
  'max-depth': 'maxDepth',
  'output-format': 'outputFormat',
};

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
 * @param {string[]} argv
 * @returns {ParsedCliArguments}
 */
const parseCliArguments = (argv) => {
  /** @type {ParsedCliArguments} */
  const parsed = {
    extraEval: [],
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
    const optionName = FLAG_ALIASES[rawOptionName] || rawOptionName;

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
    case 'outputFormat': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.outputFormat = result.value;
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
    case 'port': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.shellOptions.port = parsePositiveInteger(optionName, result.value);
      break;
    }
    case 'eval': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.extraEval.push(result.value);
      break;
    }
    default:
      throw new CliUsageError(`Unknown option --${rawOptionName}.`);
    }
  }

  if (!parsed.help && !parsed.version && parsed.target === null) {
    throw new CliUsageError('Missing required DB/COLLECTION target.');
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
  TARGET_OPTION_NAMES.forEach((name) => {
    if (Object.hasOwn(parsedCliArguments.varietyOptions, name)) {
      statements.push(renderVarAssignment(name, parsedCliArguments.varietyOptions[name]));
    }
  });

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
    shellOptions: parsedCliArguments.shellOptions,
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
    '  --outputFormat <value>           Output format, e.g. ascii or json',
    '  --quiet                          Pass --quiet through to the Mongo shell',
    '  --host <value>                   Mongo shell host',
    '  --port <number>                  Mongo shell port',
    '  --username <value>               MongoDB username',
    '  --password <value>               MongoDB password',
    '  --authenticationDatabase <value> Authentication database',
    '  --eval <javascript>              Extra JavaScript appended after CLI assignments',
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
