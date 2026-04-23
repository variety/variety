// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert/strict';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { Binary, UUID } from 'mongodb';
import VarietyHarness from '../../helpers/VarietyHarness.js';

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

const test = new VarietyHarness('test', 'bindata_subtypes');

// One document with a field per server-insertable BSON binary subtype that
// Variety intentionally maps. Subtypes 3 (UUID old) and 4 (UUID) both report
// as BinData-UUID. Vector subtype 9 fields use dtype-specific labels.
const doc = {
  binData_generic:           new Binary(Uint8Array.from([0x01, 0x02, 0x03, 0x04]), Binary.SUBTYPE_DEFAULT),
  binData_function:          new Binary(Uint8Array.from([0x01, 0x02, 0x03, 0x04]), Binary.SUBTYPE_FUNCTION),
  binData_old:               new Binary(Uint8Array.from([0x01, 0x02, 0x03, 0x04]), Binary.SUBTYPE_BYTE_ARRAY),
  binData_uuid_old:          new Binary(
    Uint8Array.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]),
    Binary.SUBTYPE_UUID_OLD
  ),
  binData_uuid:              new UUID('00112233-4455-6677-8899-aabbccddeeff'),
  binData_md5:               new Binary(
    Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]),
    Binary.SUBTYPE_MD5
  ),
  binData_encrypted:         new Binary(Uint8Array.from([0x01, 0x02, 0x03, 0x04]), 0x06),
  binData_sensitive:         new Binary(Uint8Array.from([0x01, 0x02, 0x03, 0x04]), 0x08),
  // Vector dtype payloads: byte 0 = dtype, byte 1 = padding, remaining = elements.
  binData_vector_int8:       new Binary(Uint8Array.from([0x03, 0x00, 0x01, 0x02, 0x03]), 0x09),
  binData_vector_packed_bit: new Binary(Uint8Array.from([0x10, 0x00, 0xff]), 0x09),
  binData_vector_float32:    new Binary(Uint8Array.from([0x27, 0x00, 0x00, 0x00, 0x80, 0x3f]), 0x09),
  binData_user:              new Binary(Uint8Array.from([0x01, 0x02, 0x03]), Binary.SUBTYPE_USER_DEFINED),
};

describe('Binary subtype recognition', () => {
  beforeEach(() => test.init([doc]));
  afterEach(() => test.cleanUp());

  it('should report each server-insertable mapped binary subtype under its Variety label', async () => {
    const results = await test.runJsonAnalysis({ collection: 'bindata_subtypes' }, true);
    results.validateResultsCount(13); // _id plus one field per subtype
    results.validate('_id',                        1, 100.0, { ObjectId: 1 });
    results.validate('binData_generic',            1, 100.0, { 'BinData-generic':              1 });
    results.validate('binData_function',           1, 100.0, { 'BinData-function':             1 });
    results.validate('binData_old',                1, 100.0, { 'BinData-old':                  1 });
    // Subtypes 3 (UUID old) and 4 (UUID) both map to BinData-UUID.
    results.validate('binData_uuid_old',           1, 100.0, { 'BinData-UUID':                 1 });
    results.validate('binData_uuid',               1, 100.0, { 'BinData-UUID':                 1 });
    results.validate('binData_md5',                1, 100.0, { 'BinData-MD5':                  1 });
    results.validate('binData_encrypted',          1, 100.0, { 'BinData-encrypted':            1 });
    results.validate('binData_sensitive',          1, 100.0, { 'BinData-sensitive':            1 });
    results.validate('binData_vector_int8',        1, 100.0, { 'BinData-vector[INT8]':         1 });
    results.validate('binData_vector_packed_bit',  1, 100.0, { 'BinData-vector[PACKED_BIT]':   1 });
    results.validate('binData_vector_float32',     1, 100.0, { 'BinData-vector[FLOAT32]':      1 });
    results.validate('binData_user',               1, 100.0, { 'BinData-user':                 1 });
  });

  it('should report compressed BSON column subtype under its Variety label', () => {
    const result = impl.varietyTypeOf(config, new Binary(Uint8Array.from([0x01, 0x02, 0x03, 0x04]), 0x07));
    assert.equal(result, 'BinData-compressed-column');
  });

  it('should report an unknown vector dtype byte as BinData-vector[0xNN]', () => {
    const result = impl.varietyTypeOf(config, new Binary(Uint8Array.from([0x42, 0x00, 0xde, 0xad]), 0x09));
    assert.equal(result, 'BinData-vector[0x42]');
  });

  it('should report a malformed vector payload (empty) as BinData-vector[malformed]', () => {
    const result = impl.varietyTypeOf(config, new Binary(Uint8Array.from([]), 0x09));
    assert.equal(result, 'BinData-vector[malformed]');
  });
});
