// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2012–2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
// @ts-check
'use strict';

import { equal, deepEqual }  from 'assert';

/**
 * @typedef {{
 *   _id: { key: string },
 *   totalOccurrences: number,
 *   percentContaining: number,
 *   value: { types: Record<string, number> },
 *   lastValue?: unknown
 * }} VarietyResultRow
 */

export default class JsonValidator {
  /** @type {VarietyResultRow[]} */
  results;

  /**
   * @param {VarietyResultRow[]} results
   */
  constructor(results) {
    this.results = results;
  }

  /**
   * @param {string} key
   * @param {number} totalOccurrences
   * @param {number} percentContaining
   * @param {Record<string, number>} types
   * @param {unknown} [lastValue]
   */
  validate(key, totalOccurrences, percentContaining, types, lastValue) {
    const row = this.results.find((item) => item._id.key === key);
    if (typeof row === 'undefined') {
      throw new Error(`Key '${key}' not present in results. Known keys are: [${this.results.map((item) => item._id.key).join(',')}].`);
    }
    equal(row.totalOccurrences, totalOccurrences, `TotalOccurrences of key ${key} does not match`);
    equal(row.percentContaining, percentContaining, `PercentContaining of key ${key} does not match`);
    deepEqual(row.value.types, types, `Types of key ${key} do not match`);
    if (arguments.length === 5) {
      deepEqual(row.lastValue, lastValue, `LastValue of key ${key} does not match`);
    }
  }

  /**
   * @param {number} count
   */
  validateResultsCount(count) {
    equal(this.results.length, count, `Total count of results does not match expected count. Known keys are: [${this.results.map((item) => item._id.key).join(',')}].`);
  }
}
