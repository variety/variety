// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert/strict';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { BSONSymbol, Code, DBRef, ObjectId } from 'mongodb';

const require = createRequire(import.meta.url);
const enginePath = fileURLToPath(new URL('../../../core/engine.js', import.meta.url));

/**
 * @typedef {{
 *   arrayEscape: string,
 *   excludeSubkeys: Record<string, true>,
 *   maxDepth: number,
 *   compactArrayTypes: boolean,
 *   lastValue: boolean,
 *   logKeysContinuously: boolean,
 *   maxExamples: number,
 * }} AnalyzerConfig
 * @typedef {{
 *   varietyTypeOf: (config: AnalyzerConfig, thing: unknown) => string
 * }} VarietyImpl
 */

const rawImpl = /** @type {unknown} */ (require(enginePath));
const impl = /** @type {VarietyImpl} */ (rawImpl);

/** @type {AnalyzerConfig} */
const config = {
  arrayEscape: 'XX',
  excludeSubkeys: /** @type {Record<string, true>} */ ({}),
  maxDepth: 5,
  compactArrayTypes: false,
  lastValue: false,
  logKeysContinuously: false,
  maxExamples: 0,
};

// These tests exercise the Variety analyzer directly (no MongoDB connection
// required) and prove the label each deprecated top-level BSON type receives.
//
// For BSON Undefined (type 6) and BSON DBPointer (type 12), the bson library
// used by the MongoDB Node.js driver cannot serialize these types from modern
// JavaScript values: the library drops `undefined`-valued fields on
// serialization, and there is no DBPointer constructor. Modern MongoDB 8.x
// servers also reject type-6 and type-12 on insert. Integration tests via
// MongoDB are therefore not feasible for these two types; the tests here
// exercise the Variety analyzer with the values that mongosh returns when
// deserializing legacy documents that contain these types.
describe('Deprecated top-level BSON types', () => {

  // BSON type 6: Undefined
  // The bson library deserializes a stored type-6 value as JavaScript
  // `undefined`. The Variety analyzer checks `typeof thing === 'undefined'`
  // first and returns the label `'undefined'`.
  it('should label BSON Undefined (type 6) as "undefined"', () => {
    const result = impl.varietyTypeOf(config, undefined);
    assert.equal(result, 'undefined');
  });

  // BSON type 12: DBPointer
  // The bson library maps a stored type-12 value to a DBRef object (the same
  // wrapper used for the DBRef document convention, which is a plain
  // Object/type-3). Variety reports type-12-sourced values as `'DBRef'` — a
  // broader, driver-facing label shared with the DBRef convention.
  it('should label BSON DBPointer (type 12) as "DBRef" (via driver DBRef mapping)', () => {
    const dbPointerAsDBRef = new DBRef('legacy', new ObjectId('aabbccddaabbccddaabbccdd'), 'testdb');
    const result = impl.varietyTypeOf(config, dbPointerAsDBRef);
    assert.equal(result, 'DBRef');
  });

  // BSON type 14: Symbol
  // Mongosh promotes a stored type-14 value to a plain JavaScript string, so
  // Variety reports `'String'` — a broader, merged label — in the end-to-end
  // pipeline. This is confirmed by the integration test in
  // DatatypeRecognitionTest.js (key_symbol).
  //
  // The analyzer also has a `BSONSymbol → 'BSONSymbol'` mapping. That path is
  // exercised when the value arrives as a BSONSymbol object rather than a
  // promoted string (e.g., when Variety is used programmatically via the Node.js
  // driver with promoteValues: false).
  it('should label a BSONSymbol object as "BSONSymbol" (Node.js driver path)', () => {
    const result = impl.varietyTypeOf(config, new BSONSymbol('mysymbol'));
    assert.equal(result, 'BSONSymbol');
  });

  it('should label mongosh-promoted BSON Symbol (type 14) as "String"', () => {
    // Mongosh promotes type-14 to a plain JavaScript string before passing it
    // to the Variety analyzer running inside the shell.
    const result = impl.varietyTypeOf(config, 'mysymbol');
    assert.equal(result, 'String');
  });

  // BSON type 15: JavaScript code with scope
  // Mongosh deserializes a stored type-15 value as a Code object with a scope
  // property. Variety reports `'Code'`. See also the integration-level
  // assertion in DatatypeRecognitionTest.js (key_code).
  it('should label JavaScript code with scope (type 15) as "Code"', () => {
    const result = impl.varietyTypeOf(config, new Code('function() { return n; }', { n: 1 }));
    assert.equal(result, 'Code');
  });

});
