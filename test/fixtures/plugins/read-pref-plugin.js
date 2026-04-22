// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
/**
 * @typedef {{ getMongo(): { getReadPrefMode(): string } }} ShellDb
 */

var shellContext = /** @type {{ db: ShellDb }} */ (
  /** @type {unknown} */ (typeof globalThis !== 'undefined' ? globalThis : this)
);

module.exports = {
  onConfig() {
    var readPreferenceMode = shellContext.db.getMongo().getReadPrefMode();
    if (readPreferenceMode !== 'secondary') {
      throw new Error(`Expected secondary read preference, received ${readPreferenceMode}.`);
    }
  },
};
