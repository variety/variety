// @ts-nocheck
'use strict';

const path = require('path');

class CliUsageError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = 'CliUsageError';
    this.exitCode = exitCode;
  }
}

const COMPATIBILITY_ENV_KEYS = ['DB', 'EVAL_CMDS', 'VARIETYJS_DIR'];
const TARGET_OPTION_NAMES = ['query', 'sort', 'limit', 'maxDepth', 'outputFormat'];
const FLAG_ALIASES = {
  'authentication-database': 'authenticationDatabase',
  'max-depth': 'maxDepth',
  'output-format': 'outputFormat',
};

const hasCompatibilityEnv = (env) => {
  return COMPATIBILITY_ENV_KEYS.some((key) => typeof env[key] !== 'undefined');
};

const resolveCompatibilityScriptPath = (env) => {
  if (env.VARIETYJS_DIR) {
    return path.join(env.VARIETYJS_DIR, 'variety.js');
  }

  return './variety.js';
};

const resolveCliScriptPath = (env) => {
  if (env.VARIETYJS_DIR) {
    return path.join(env.VARIETYJS_DIR, 'variety.js');
  }

  return path.resolve(__dirname, '..', 'variety.js');
};

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

const parsePositiveInteger = (optionName, rawValue) => {
  if (!/^\d+$/.test(rawValue)) {
    throw new CliUsageError(`--${optionName} must be an integer, received ${JSON.stringify(rawValue)}.`);
  }

  const numericValue = Number(rawValue);
  if (!Number.isSafeInteger(numericValue)) {
    throw new CliUsageError(`--${optionName} is too large: ${rawValue}.`);
  }

  return numericValue;
};

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

const parseJsonObject = (optionName, rawValue) => {
  let parsedValue;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch (error) {
    throw new CliUsageError(`--${optionName} must be strict JSON. ${error.message}`);
  }

  if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== 'object') {
    throw new CliUsageError(`--${optionName} must be a JSON object.`);
  }

  return parsedValue;
};

const readOptionValue = (argv, currentIndex, inlineValue, optionName) => {
  if (typeof inlineValue !== 'undefined') {
    return { nextIndex: currentIndex, value: inlineValue };
  }

  const nextValue = argv[currentIndex + 1];
  if (typeof nextValue === 'undefined' || nextValue.startsWith('--')) {
    throw new CliUsageError(`--${optionName} requires a value.`);
  }

  return {
    nextIndex: currentIndex + 1,
    value: nextValue,
  };
};

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

const parseCliArguments = (argv) => {
  const parsed = {
    extraEval: [],
    shellOptions: {},
    target: null,
    varietyOptions: {},
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith('--')) {
      if (parsed.target !== null) {
        throw new CliUsageError(`Unexpected extra positional argument ${JSON.stringify(argument)}.`);
      }

      parsed.target = parseTarget(argument);
      continue;
    }

    const [rawOptionName, inlineValue] = argument.slice(2).split('=', 2);
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
    case 'query':
    case 'sort': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions[optionName] = parseJsonObject(optionName, result.value);
      break;
    }
    case 'limit':
    case 'maxDepth': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions[optionName] = parsePositiveInteger(optionName, result.value);
      break;
    }
    case 'outputFormat': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.varietyOptions.outputFormat = result.value;
      break;
    }
    case 'host':
    case 'username':
    case 'password':
    case 'authenticationDatabase': {
      const result = readOptionValue(argv, index, inlineValue, optionName);
      index = result.nextIndex;
      parsed.shellOptions[optionName] = result.value;
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

const renderVarAssignment = (name, value) => {
  return `var ${name} = ${JSON.stringify(value)}`;
};

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

const createCompatibilityPlan = (env) => {
  return {
    database: env.DB || '',
    evalCode: stripMatchingOuterQuotes(env.EVAL_CMDS || ''),
    mode: 'compatibility',
    scriptPath: resolveCompatibilityScriptPath(env),
    shellOptions: {},
  };
};

const createCliPlan = (argv, env) => {
  const parsedCliArguments = parseCliArguments(argv);
  if (parsedCliArguments.help) {
    return { mode: 'help' };
  }

  if (parsedCliArguments.version) {
    return { mode: 'version' };
  }

  return {
    database: parsedCliArguments.target.database,
    evalCode: buildEvalCode(parsedCliArguments),
    mode: 'cli',
    scriptPath: resolveCliScriptPath(env),
    shellOptions: parsedCliArguments.shellOptions,
  };
};

const createExecutionPlan = (argv, env) => {
  if (argv.length === 0) {
    if (hasCompatibilityEnv(env)) {
      return createCompatibilityPlan(env);
    }

    throw new CliUsageError('Missing required DB/COLLECTION target.');
  }

  return createCliPlan(argv, env);
};

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
