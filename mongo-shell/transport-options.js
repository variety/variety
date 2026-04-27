// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
'use strict';

const optionValidationModule = /** @type {typeof import('../core/option-validation.js')} */ (require('../core/option-validation.js'));
const { validateOptions } = optionValidationModule;

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

  return /** @type {ShellOptions} */ (validateOptions(/** @type {Record<string, unknown>} */ (input), SHELL_OPTION_DESCRIPTORS));
};

module.exports = {
  SHELL_OPTION_DESCRIPTORS,
  validateShellOptions,
};
