// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// BUILT-IN FORMATTER: ASCII TABLE
// =============================================================================
(function (shellContext) {
  'use strict';

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  shellContext.__varietyFormatters = shellContext.__varietyFormatters || Object.create(null);

  /**
   * Returns a formatter that renders results as a padded ASCII table.
   * @param {object} config - The parsed Variety config (uses config.lastValue and config.arrayEscape).
   * @returns {{ formatResults: function(Array): string }}
   */
  shellContext.__varietyFormatters.ascii = (config) => {
    const formatResults = (results) => {
      const headers = ['key', 'types', 'occurrences', 'percents'];
      if (config.lastValue) {
        headers.push('lastValue');
      }
      if (config.maxExamples > 0) {
        headers.push('examples');
      }

      // Return the number of decimal places, or 1 for integers (1.23 => 2, 100 => 1, 0.1415 => 4).
      const significantDigits = (value) => {
        const res = value.toString().match(/^[0-9]+\.([0-9]+)$/);
        return res !== null ? res[1].length : 1;
      };

      const maxDigits = results
        .map((value) => significantDigits(value.percentContaining))
        .reduce((acc, val) => Math.max(acc, val), 1);

      const rows = results.map((row) => {
        const typeKeys = Object.keys(row.value.types);
        const types = typeKeys.length > 1
          ? typeKeys.map((type) => `${type} (${row.value.types[type]})`)
          : typeKeys;

        const rawArray = [row._id.key, types, row.totalOccurrences, row.percentContaining.toFixed(Math.min(maxDigits, 20))];
        if (config.lastValue && row.lastValue) {
          rawArray.push(row.lastValue);
        }
        if (config.maxExamples > 0 && row.examples) {
          rawArray.push(row.examples.join(', '));
        }
        return rawArray;
      });

      const table = [headers, headers.map(() => '')].concat(rows);
      const colMaxWidth = (arr, index) => Math.max(...arr.map((row) => row[index] ? row[index].toString().length : 0));
      const pad = (width, string, symbol) => width <= string.length ? string : pad(width, isNaN(string) ? string + symbol : symbol + string, symbol);
      const formattedTable = table.map((row, ri) =>
        `| ${row.map((cell, i) => pad(colMaxWidth(table, i), cell.toString(), ri === 1 ? '-' : ' ')).join(' | ')} |`
      );
      const border = `+${pad(formattedTable[0].length - 2, '', '-')}+`;
      return [border].concat(formattedTable).concat(border).join('\n');
    };

    return {formatResults};
  };
}(this));
