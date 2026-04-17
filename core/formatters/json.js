// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2012–2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// BUILT-IN FORMATTER: JSON
// =============================================================================
(function (shellContext) {
  'use strict';

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  shellContext.__varietyFormatters = shellContext.__varietyFormatters || Object.create(null);

  /**
   * Returns a formatter that serializes results as pretty-printed JSON.
   * @returns {{ formatResults: function(Array): string }}
   */
  shellContext.__varietyFormatters.json = () => ({
    formatResults: (results) => JSON.stringify(results, null, 2),
  });
}(this));
