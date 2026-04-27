// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
'use strict';

const optionValidationModule = /** @type {typeof import('../core/option-validation.js')} */ (require('../core/option-validation.js'));
const { validateOptions } = optionValidationModule;

const MONGODB_URI_PREFIXES = ['mongodb://', 'mongodb+srv://'];
const URI_CONFLICTING_KEYS = ['host', 'port', 'username', 'password', 'authenticationDatabase'];

/**
 * @typedef {{
 *   authenticationDatabase?: string,
 *   host?: string,
 *   password?: string,
 *   port?: number,
 *   quiet?: boolean,
 *   uri?: string,
 *   username?: string,
 * }} ShellOptions
 */

/**
 * @typedef {'boolean' | 'nonNegativeInteger' | 'object' | 'positiveInteger' | 'string' | 'stringArray'} OptionKind
 */

/**
 * @typedef {{
 *   name: string,
 *   kind: OptionKind,
 *   allowNull?: boolean,
 *   requireNonEmpty?: boolean,
 * }} OptionDescriptor
 */

/** @type {OptionDescriptor[]} */
const SHELL_OPTION_DESCRIPTORS = [
  { name: 'host',                   kind: 'string' },
  { name: 'port',                   kind: 'positiveInteger' },
  { name: 'username',               kind: 'string' },
  { name: 'password',               kind: 'string' },
  { name: 'authenticationDatabase', kind: 'string' },
  { name: 'quiet',                  kind: 'boolean' },
  { name: 'uri',                    kind: 'string',  requireNonEmpty: true },
];

/** @type {Set<string>} */
const KNOWN_SHELL_OPTION_KEYS = new Set(SHELL_OPTION_DESCRIPTORS.map((d) => d.name));

/**
 * @param {ShellOptions | undefined} input
 * @returns {ShellOptions}
 */
const validateShellOptions = (input) => {
  if (typeof input === 'undefined') {
    return {};
  }

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Shell options must be an object.');
  }

  for (const key of Object.keys(input)) {
    if (!KNOWN_SHELL_OPTION_KEYS.has(key)) {
      throw new Error(`Unknown shell option: ${JSON.stringify(key)}.`);
    }
  }

  const validated = /** @type {ShellOptions} */ (validateOptions(/** @type {Record<string, unknown>} */ (input), SHELL_OPTION_DESCRIPTORS));

  if (typeof validated.uri === 'string') {
    if (!MONGODB_URI_PREFIXES.some((prefix) => /** @type {string} */ (validated.uri).startsWith(prefix))) {
      throw new Error('uri must start with "mongodb://" or "mongodb+srv://".');
    }

    const conflicting = URI_CONFLICTING_KEYS.filter((key) => Object.hasOwn(validated, key));
    if (conflicting.length > 0) {
      throw new Error(`uri cannot be combined with ${conflicting.join(', ')}.`);
    }
  }

  return validated;
};

module.exports = {
  SHELL_OPTION_DESCRIPTORS,
  validateShellOptions,
};
