// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2012–2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// IMPLEMENTATION SECTION
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
        const binDataTypes = {
          0x00: 'generic',
          0x01: 'function',
          0x02: 'old',
          0x03: 'UUID',
          0x04: 'UUID',
          0x05: 'MD5',
          0x80: 'user',
        };
        return `BinData-${binDataTypes[getBinDataSubtype(thing)]}`;
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

      if (config.lastValue) {
        if (type in {'String': true, 'Boolean': true}) {
          result[key][type] = value.toString();
        } else if (type in {'Number': true, 'NumberLong': true}) {
          result[key][type] = value.valueOf();
        } else if (type === 'ObjectId') {
          result[key][type] = value.str;
        } else if (type === 'Date') {
          result[key][type] = new Date(value).getTime();
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
        }
        existing.totalOccurrences += 1;
      } else {
        let lastValue = null;
        let lastType = null;
        const types = createKeyMap();
        for (const newType of Object.keys(docResult[key])) {
          types[newType] = 1;
          lastValue = docResult[key][newType];
          lastType = newType;
          if (config.logKeysContinuously) {
            log(`Found new key type "${key}" type "${newType}"`);
          }
        }
        interimResults[key] = {types, totalOccurrences: 1};
        if (config.lastValue) {
          interimResults[key].lastValue = lastValue ? lastValue : `[${lastType}]`;
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

      varietyResults.push(obj);
    }
    return varietyResults;
  };

  // Merge the keys and types of current object into accumulator object.
  const reduceDocuments = (config, accumulator, object, log) => {
    const docResult = analyseDocument(config, serializeDoc(config, object));
    mergeDocument(config, docResult, accumulator, log);
    return accumulator;
  };

  const reduceCursor = (cursor, callback, initialValue) => {
    let result = initialValue;
    cursor.forEach((obj) => {
      result = callback(result, obj);
    });
    return result;
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

  // Orchestrates a Variety analysis from a parsed config and constructed
  // pluginsRunner, pulling every shell primitive it needs from `deps`.
  const run = (config, pluginsRunner, deps) => {
    const {db, connect, log, print, countMatchingDocuments} = deps;

    // limit(0) meant "no limit" in MongoDB ≤7 but is rejected by MongoDB 8+; guard against it.
    let cursor = db.getCollection(config.collection).find(config.query).sort(config.sort);
    if (config.limit > 0) { cursor = cursor.limit(config.limit); }
    const interimResults = reduceCursor(
      cursor,
      (acc, obj) => reduceDocuments(config, acc, obj, log),
      createKeyMap()
    );
    const varietyResults = convertResults(
      config,
      interimResults,
      countMatchingDocuments(config.collection, config.query, config.limit)
    )
      .filter(buildResultFilter(config))
      .sort(compareResults);

    if (config.persistResults) {
      const resultsCollectionName = config.resultsCollection;
      const resultsDB = !config.resultsDatabase.includes('/')
        // Local database; don't reconnect.
        ? db.getMongo().getDB(config.resultsDatabase)
        // Remote database, establish new connection.
        : connect(config.resultsDatabase);

      if (config.resultsUser !== null && config.resultsPass !== null) {
        resultsDB.auth(config.resultsUser, config.resultsPass);
      }

      // Replace results collection.
      log(`replacing results collection: ${resultsCollectionName}`);
      resultsDB.getCollection(resultsCollectionName).drop();
      resultsDB.getCollection(resultsCollectionName).insert(varietyResults);
    }

    const formatterFactory = shellContext.__varietyFormatters[config.outputFormat];
    if (typeof formatterFactory !== 'function') {
      throw new Error(`Unknown outputFormat "${config.outputFormat}". Valid values are: ${Object.keys(shellContext.__varietyFormatters).join(', ')}.`);
    }
    const builtInFormatter = formatterFactory(config);

    const pluginsOutput = pluginsRunner.execute('formatResults', varietyResults);
    const outputs = pluginsOutput.length > 0 ? pluginsOutput : [builtInFormatter.formatResults(varietyResults)];
    outputs.forEach((output) => print(output));
  };

  shellContext.__varietyImpl = {
    createKeyMap,
    shellToJson,
    getBinDataSubtype,
    getBinDataHex,
    getRawBsonTypeName,
    normalizeBsonTypeName,
    getSpecialTypeName,
    varietyTypeOf,
    serializeDoc,
    analyseDocument,
    mergeDocument,
    convertResults,
    reduceDocuments,
    reduceCursor,
    run,
  };
}(this));
