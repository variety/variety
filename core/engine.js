// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// ENGINE SECTION
// =============================================================================
(function (shellContext) {
  'use strict';

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const createKeyMap = () => Object.create(null);

  const shellToJson = (value) => {
    if (typeof tojson === 'function') {
      return tojson(value);
    }

    if (shellContext.EJSON && typeof shellContext.EJSON.stringify === 'function') {
      return shellContext.EJSON.stringify(value);
    }

    return JSON.stringify(value);
  };

  const getBinDataSubtype = (binData) => {
    if (!binData) { return undefined; }
    if (typeof binData.subtype === 'function') {
      return binData.subtype();
    }
    if (typeof binData.sub_type !== 'undefined') {
      return binData.sub_type;
    }
    return undefined;
  };

  const getBinDataHex = (binData) => {
    if (binData && typeof binData.hex === 'function') {
      return binData.hex();
    }
    if (binData && typeof Buffer !== 'undefined' && binData.buffer) {
      return Buffer.from(binData.buffer).toString('hex');
    }
    return shellToJson(binData);
  };

  const getVectorDtypeByte = (binData) => {
    if (!binData) { return undefined; }
    if (typeof binData.hex === 'function') {
      const hex = binData.hex();
      if (typeof hex === 'string' && hex.length >= 2 && /^[0-9a-f]{2}/i.test(hex)) {
        return parseInt(hex.slice(0, 2), 16);
      }
      return undefined;
    }
    if (typeof Buffer !== 'undefined' && binData.buffer) {
      const buf = Buffer.from(binData.buffer);
      return buf.length > 0 ? buf[0] : undefined;
    }
    return undefined;
  };

  const getVectorDtypeLabel = (binData) => {
    const dtypeByte = getVectorDtypeByte(binData);
    if (typeof dtypeByte === 'undefined') {
      return 'BinData-vector[malformed]';
    }
    const dtypeAliases = {
      0x03: 'INT8',
      0x10: 'PACKED_BIT',
      0x27: 'FLOAT32',
    };
    const alias = dtypeAliases[dtypeByte];
    if (alias) {
      return `BinData-vector[${alias}]`;
    }
    return `BinData-vector[0x${dtypeByte.toString(16).padStart(2, '0')}]`;
  };

  const getRawBsonTypeName = (thing) => {
    if (!thing || typeof thing !== 'object') {
      return undefined;
    }

    if (typeof thing._bsontype === 'string') {
      return thing._bsontype;
    }

    if (thing.constructor && typeof thing.constructor.name === 'string') {
      return thing.constructor.name;
    }

    return undefined;
  };

  const normalizeBsonTypeName = (rawTypeName) => {
    const typeMap = {
      Binary: 'Binary',
      BinData: 'Binary',
      UUID: 'Binary',
      Long: 'NumberLong',
      NumberLong: 'NumberLong',
      ObjectId: 'ObjectId',
      Decimal128: 'Decimal128',
      NumberDecimal: 'Decimal128',
      Timestamp: 'Timestamp',
      Code: 'Code',
      RegExp: 'BSONRegExp',
      BSONRegExp: 'BSONRegExp',
      MinKey: 'MinKey',
      MaxKey: 'MaxKey',
      DBRef: 'DBRef',
      Double: 'Double',
      Int32: 'Int32',
      BSONSymbol: 'BSONSymbol',
    };

    return typeMap[rawTypeName];
  };

  const getSpecialTypeName = (thing) => {
    // Issue #164 (@vitorcampos-db): BSON wrappers like Decimal128 should not
    // fall through as plain Object values.
    const normalizedType = normalizeBsonTypeName(getRawBsonTypeName(thing));
    if (typeof normalizedType !== 'undefined') {
      return normalizedType;
    }

    if (typeof NumberLong !== 'undefined' && thing instanceof NumberLong) {
      return 'NumberLong';
    }

    if (typeof ObjectId !== 'undefined' && thing instanceof ObjectId) {
      return 'ObjectId';
    }

    if (typeof BinData !== 'undefined' && thing instanceof BinData) {
      return 'Binary';
    }

    return undefined;
  };

  // varietyTypeOf must remain a regular function (not an arrow function) because
  // the no-argument guard below relies on the function's own `arguments` object,
  // which arrow functions do not have.
  const varietyTypeOf = function(config, thing) {
    if (arguments.length < 2) { throw new Error('varietyTypeOf() requires an argument'); }

    if (typeof thing === 'undefined') {
      return 'undefined';
    } else if (typeof thing !== 'object') {
      // capitalize the first letter so the output matches the other return values. ―JC
      const typeofThing = typeof thing;
      return `${typeofThing[0].toUpperCase()}${typeofThing.slice(1)}`;
    } else {
      const specialType = getSpecialTypeName(thing);
      if (Array.isArray(thing)) {
        if (!config.compactArrayTypes) {
          return 'Array';
        }

        if (thing.length === 0) {
          return 'Array(empty)';
        }

        const seenElementTypes = Object.create(null);
        thing.forEach((item) => {
          seenElementTypes[varietyTypeOf(config, item)] = true;
        });

        return `Array(${Object.keys(seenElementTypes).sort().join('|')})`;
      } else if (thing === null) {
        return 'null';
      } else if (thing instanceof Date) {
        return 'Date';
      } else if (specialType === 'Binary') {
        const subtype = getBinDataSubtype(thing);
        if (subtype === 0x09) {
          return getVectorDtypeLabel(thing);
        }
        const binDataTypes = {
          0x00: 'generic',
          0x01: 'function',
          0x02: 'old',
          0x03: 'UUID',
          0x04: 'UUID',
          0x05: 'MD5',
          0x06: 'encrypted',
          0x07: 'compressed-column',
          0x08: 'sensitive',
          0x80: 'user',
        };
        return `BinData-${binDataTypes[subtype]}`;
      } else if (typeof specialType !== 'undefined') {
        return specialType;
      } else {
        return 'Object';
      }
    }
  };

  // Flattens object keys to 1D. e.g. {'key1':1, 'key2':{'key3':2}} becomes {'key1':1, 'key2.key3':2}.
  // We assume no '.' characters in the keys, which is an OK assumption for MongoDB.
  const serializeDoc = (config, doc) => {
    const result = createKeyMap();

    // Recurse only into plain objects and arrays; BSON wrappers should stay scalar.
    const isHash = (v) => Array.isArray(v) || varietyTypeOf(config, v) === 'Object';

    const arrayRegex = new RegExp(`\\.${config.arrayEscape}\\d+${config.arrayEscape}\\.`, 'g');

    const serialize = (document, parentKey, depth) => {
      if (parentKey.replace(arrayRegex, '.') in config.excludeSubkeys) {
        return;
      }
      for (const key of Object.keys(document)) {
        const value = document[key];
        // Translate array index from {parent}.{index} to {parent}.arrayEscape{index}arrayEscape.
        const escapedKey = Array.isArray(document)
          ? `${config.arrayEscape}${key}${config.arrayEscape}`
          : key;
        result[`${parentKey}${escapedKey}`] = value;
        // Recurse into nested objects only if we have not reached max depth.
        if (isHash(value) && depth > 1) {
          serialize(value, `${parentKey}${escapedKey}.`, depth - 1);
        }
      }
    };
    serialize(doc, '', config.maxDepth);
    return result;
  };

  // Convert document to key-value map, where value is always an object with types as keys.
  const analyseDocument = (config, document) => {
    const result = createKeyMap();
    const arrayRegex = new RegExp(`\\.${config.arrayEscape}\\d+${config.arrayEscape}`, 'g');
    for (const rawKey of Object.keys(document)) {
      const value = document[rawKey];
      const key = rawKey.replace(arrayRegex, `.${config.arrayEscape}`);
      if (typeof result[key] === 'undefined') {
        result[key] = {};
      }
      const type = varietyTypeOf(config, value);
      result[key][type] = null;

      if (config.lastValue || config.maxExamples > 0) {
        if (type in {'String': true, 'Boolean': true}) {
          result[key][type] = value.toString();
        } else if (type in {'Number': true, 'NumberLong': true}) {
          result[key][type] = value.valueOf();
        } else if (type === 'ObjectId') {
          result[key][type] = typeof value.toHexString === 'function' ? value.toHexString() : value.str;
        } else if (type === 'Date') {
          result[key][type] = new Date(value).toISOString();
        } else if (type.startsWith('BinData')) {
          result[key][type] = getBinDataHex(value);
        }
      }
    }

    return result;
  };

  const mergeDocument = (config, docResult, interimResults, log) => {
    for (const key of Object.keys(docResult)) {
      if (key in interimResults) {
        const existing = interimResults[key];

        for (const type of Object.keys(docResult[key])) {
          if (type in existing.types) {
            existing.types[type] += 1;
          } else {
            existing.types[type] = 1;
            if (config.logKeysContinuously) {
              log(`Found new key type "${key}" type "${type}"`);
            }
          }
          if (config.maxExamples > 0 && existing.examples.length < config.maxExamples) {
            const rawVal = docResult[key][type];
            existing.examples.push(rawVal !== null ? rawVal : `[${type}]`);
          }
        }
        existing.totalOccurrences += 1;
      } else {
        let lastValue = null;
        let lastType = null;
        const types = createKeyMap();
        const examples = [];
        for (const newType of Object.keys(docResult[key])) {
          types[newType] = 1;
          lastValue = docResult[key][newType];
          lastType = newType;
          if (config.maxExamples > 0 && examples.length < config.maxExamples) {
            examples.push(lastValue !== null ? lastValue : `[${newType}]`);
          }
          if (config.logKeysContinuously) {
            log(`Found new key type "${key}" type "${newType}"`);
          }
        }
        interimResults[key] = {types, totalOccurrences: 1};
        if (config.lastValue) {
          interimResults[key].lastValue = lastValue ? lastValue : `[${lastType}]`;
        }
        if (config.maxExamples > 0) {
          interimResults[key].examples = examples;
        }
      }
    }
  };

  const convertResults = (config, interimResults, documentsCount) => {
    const varietyResults = [];
    for (const key of Object.keys(interimResults)) {
      const entry = interimResults[key];

      const obj = {
        _id: {key},
        value: {types: {...entry.types}},
        totalOccurrences: entry.totalOccurrences,
        percentContaining: entry.totalOccurrences * 100 / documentsCount,
      };

      if (config.lastValue) {
        obj.lastValue = entry.lastValue;
      }

      if (config.maxExamples > 0) {
        obj.examples = entry.examples;
      }

      varietyResults.push(obj);
    }
    return varietyResults;
  };

  const createAnalysisState = () => createKeyMap();

  // Merge the keys and types of current object into accumulator object.
  const ingestDocument = (config, accumulator, object, log) => {
    const docResult = analyseDocument(config, serializeDoc(config, object));
    mergeDocument(config, docResult, accumulator, log);
    return accumulator;
  };

  // By default, keys ending in an array index (e.g. "tags.XX") are suppressed,
  // since the parent key already captures the Array type. Set showArrayElements:true
  // to include them — useful for verifying element-type consistency within arrays.
  const buildResultFilter = (config) => {
    const arrayRegex = new RegExp(`\\.${config.arrayEscape}$`, 'g');
    return (item) => config.showArrayElements || !item._id.key.match(arrayRegex);
  };

  // Sort desc by totalOccurrences, or by key asc if occurrences are equal.
  const compareResults = (a, b) => {
    const countsDiff = b.totalOccurrences - a.totalOccurrences;
    return countsDiff !== 0 ? countsDiff : a._id.key.localeCompare(b._id.key);
  };

  const finalizeResults = (config, interimResults, documentsCount) => {
    return convertResults(config, interimResults, documentsCount)
      .filter(buildResultFilter(config))
      .sort(compareResults);
  };

  /**
   * @param {Record<string, unknown>} config
   * @param {Iterable<Record<string, unknown>>} documents
   * @param {{
   *   documentsCount?: number,
   *   log?: (message: string) => void
   * }} [options] When documentsCount is provided, percentContaining uses that
   * value instead of the number of iterated documents.
   */
  const analyzeDocuments = (config, documents, options) => {
    const analysisOptions = options || {};
    const log = typeof analysisOptions.log === 'function' ? analysisOptions.log : () => {};
    const interimResults = createAnalysisState();
    let documentsCount = 0;

    for (const document of documents) {
      ingestDocument(config, interimResults, document, log);
      documentsCount += 1;
    }

    if (typeof analysisOptions.documentsCount === 'number') {
      documentsCount = analysisOptions.documentsCount;
    }

    return finalizeResults(config, interimResults, documentsCount);
  };

  const engine = {
    createAnalysisState,
    createKeyMap,
    shellToJson,
    getBinDataSubtype,
    getBinDataHex,
    getVectorDtypeByte,
    getVectorDtypeLabel,
    getRawBsonTypeName,
    normalizeBsonTypeName,
    getSpecialTypeName,
    varietyTypeOf,
    serializeDoc,
    analyseDocument,
    mergeDocument,
    convertResults,
    ingestDocument,
    buildResultFilter,
    compareResults,
    finalizeResults,
    analyzeDocuments,
  };

  shellContext.__varietyEngine = engine;

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = engine;
  }
}(this));
