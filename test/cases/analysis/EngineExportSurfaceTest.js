// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert/strict';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const enginePath = fileURLToPath(new URL('../../../core/engine.js', import.meta.url));
const rawImpl = /** @type {unknown} */ (require(enginePath));

describe('Engine export surface', () => {
  it('exports only the intentional core engine API (#334)', () => {
    const exportedNames = Object.keys(/** @type {Record<string, unknown>} */ (rawImpl)).sort();

    assert.deepEqual(exportedNames, [
      'analyzeDocuments',
      'createAnalysisState',
      'finalizeResults',
      'ingestDocument',
      'varietyTypeOf',
    ]);
  });
});
