// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
/**
 * @typedef {import('../utils/JsonValidator.js').VarietyResultRow} VarietyResultRow
 * @typedef {{ delimiter?: string | undefined }} CsvPluginContext
 * @typedef {{ delimiter?: string | undefined }} CsvPluginConfig
 */

/**
 * @this {CsvPluginContext}
 * @param {VarietyResultRow[]} varietyResults
 * @returns {string}
 */
var getCsv = function(varietyResults) {
  var delimiter = this.delimiter || '|';
  var headers = ['key', 'types', 'occurrences', 'percents'];
  var table = [headers.join(delimiter)];
  var rows = varietyResults.map(function(key) {
    return [key._id.key, Object.keys(key.value.types).sort(), key.totalOccurrences, key.percentContaining].join(delimiter);
  }, this);
  return table.concat(rows).join('\n');
};

/**
 * @this {CsvPluginContext}
 * @param {CsvPluginConfig} pluginConfig
 */
var setConfig = function(pluginConfig) {
  this.delimiter = pluginConfig.delimiter;
};

module.exports = {
  init: setConfig,
  formatResults: getCsv
};
