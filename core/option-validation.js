// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// OPTION VALIDATION SECTION
// =============================================================================
/**
 * @param {typeof globalThis} shellContext
 */
(function (shellContext) {
  'use strict';

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
   * }} VarietyOptionValidationApi
   */

  const root = /** @type {typeof globalThis & { __varietyOptionValidation?: VarietyOptionValidationApi }} */ (
    typeof globalThis !== 'undefined' ? globalThis : shellContext
  );

  /**
   * @param {object} value
   * @param {string} key
   * @returns {boolean}
   */
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

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
   * Validates a set of named options against a descriptor table, dispatching each
   * present key to the appropriate validator by kind. Unknown keys are ignored;
   * undefined-valued keys are skipped (treated as absent).
   *
   * @param {Record<string, unknown>} source
   * @param {OptionDescriptor[]} descriptors
   * @returns {Record<string, unknown>}
   */
  const validateOptions = (source, descriptors) => {
    /** @type {Record<string, unknown>} */
    const result = {};
    for (const desc of descriptors) {
      const { name, kind } = desc;
      if (!hasOwn(source, name)) {
        continue;
      }
      const value = source[name];
      if (typeof value === 'undefined') {
        continue;
      }
      switch (kind) {
      case 'boolean':
        result[name] = validateBooleanOption(name, value);
        break;
      case 'nonNegativeInteger':
        result[name] = validateNonNegativeIntegerOption(name, value);
        break;
      case 'object':
        result[name] = validateObjectOption(name, value);
        break;
      case 'string':
        result[name] = validateStringOption(name, value, desc.allowNull ?? false, desc.requireNonEmpty ?? false);
        break;
      case 'stringArray':
        result[name] = validateStringArrayOption(name, value);
        break;
      }
    }
    return result;
  };

  const optionValidationApi = /** @type {VarietyOptionValidationApi} */ ({ validateOptions });

  root.__varietyOptionValidation = optionValidationApi;

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = optionValidationApi;
  }
}(this));
