/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any
outliers to that schema. Particularly useful when you inherit a codebase with
data dump and want to quickly learn how the data's structured. Also useful for
finding rare keys.

Please see https://github.com/variety/variety for details.

Released by James Cropcho, © 2012–2026, under the MIT License. */

(function (shellContext) {
  'use strict'; // wraps everything for which we can use strict mode ―JC

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const shellIsQuiet = () => {
    if (typeof __quiet !== 'undefined' && __quiet) {
      return true;
    }

    return typeof process !== 'undefined' &&
      process &&
      process.argv &&
      process.argv.includes('--quiet');
  };

  const log = (message) => {
    if (!shellIsQuiet()) {
      print(message);
    }
  };

  const shellToJson = (value) => {
    if (typeof tojson === 'function') {
      return tojson(value);
    }

    if (shellContext.EJSON && typeof shellContext.EJSON.stringify === 'function') {
      return shellContext.EJSON.stringify(value);
    }

    return JSON.stringify(value);
  };

  const shellPrintJson = (value) => {
    print(JSON.stringify(value, null, 2));
  };

  const createKeyMap = () => Object.create(null);

  const getDatabase = (name) => {
    if (typeof db.getSisterDB === 'function') {
      return db.getSisterDB(name);
    }

    return db.getMongo().getDB(name);
  };

  log('Variety: A MongoDB Schema Analyzer');
  log('Version 1.5.2, released 30 September 2025');

  const dbs = [];
  const emptyDbs = [];

  if (typeof slaveOk !== 'undefined') {
    if (slaveOk === true) {
      db.getMongo().setSlaveOk();
    }
  }

  const knownDatabases = db.adminCommand('listDatabases').databases;
  if (typeof knownDatabases !== 'undefined') { // not authorized user receives error response (json) without databases key
    knownDatabases.forEach((d) => {
      const collectionNames = getDatabase(d.name).getCollectionNames();
      if (collectionNames.length > 0) {
        dbs.push(d.name);
      } else {
        emptyDbs.push(d.name);
      }
    });

    if (emptyDbs.includes(db.getName())) {
      throw new Error(`The database specified (${db.getName()}) is empty.\n` +
          `Possible database options are: ${dbs.join(', ')}.`);
    }

    if (!dbs.includes(db.getName())) {
      throw new Error(`The database specified (${db.getName()}) does not exist.\n` +
          `Possible database options are: ${dbs.join(', ')}.`);
    }
  }

  const collNames = db.getCollectionNames().join(', ');
  if (typeof collection === 'undefined') {
    throw new Error('You have to supply a \'collection\' variable, à la --eval \'var collection = "animals"\'.\n' +
        `Possible collection options for database specified: ${collNames}.\n` +
        'Please see https://github.com/variety/variety for details.');
  }

  const countMatchingDocuments = (collectionName, query, limit) => {
    const coll = db.getCollection(collectionName);
    const options = (typeof limit === 'number' && limit > 0) ? { limit } : undefined;
    return coll.countDocuments(query, options);
  };

  if (countMatchingDocuments(collection, {}) === 0) {
    throw new Error(`The collection specified (${collection}) in the database specified (${db.getName()}) does not exist or is empty.\n` +
        `Possible collection options for database specified: ${collNames}.`);
  }

  const readConfig = (configProvider) => {
    const config = {};
    const read = (name, defaultValue) => {
      const value = typeof configProvider[name] !== 'undefined' ? configProvider[name] : defaultValue;
      config[name] = value;
      log(`Using ${name} of ${shellToJson(value)}`);
    };
    read('collection', null);
    read('query', {});
    read('limit', countMatchingDocuments(config.collection, config.query));
    read('maxDepth', 99);
    read('sort', {_id: -1});
    read('outputFormat', 'ascii');
    read('persistResults', false);
    read('resultsDatabase', 'varietyResults');
    read('resultsCollection', `${collection}Keys`);
    read('resultsUser', null);
    read('resultsPass', null);
    read('logKeysContinuously', false);
    read('excludeSubkeys', []);
    read('arrayEscape', 'XX');
    read('showArrayElements', false);
    read('compactArrayTypes', false);
    read('lastValue', false);

    // Translate excludeSubkeys into a set-like object for compatibility.
    config.excludeSubkeys = config.excludeSubkeys.reduce((result, item) => {
      result[`${item}.`] = true;
      return result;
    }, createKeyMap());

    return config;
  };

  const config = readConfig(shellContext);

  const createPluginsRunner = (context) => {
    const parsePath = (val) => val.slice(-3) !== '.js' ? `${val}.js` : val;
    const parseConfig = (val) => {
      const cfg = {};
      val.split('&').reduce((acc, entry) => {
        const parts = entry.split('=');
        acc[parts[0]] = parts[1];
        return acc;
      }, cfg);
      return cfg;
    };

    const plugins = typeof context.plugins !== 'undefined'
      ? context.plugins.split(',')
        .map((p) => p.trim())
        .map((definition) => {
          const path = parsePath(definition.split('|')[0]);
          const cfg = parseConfig(definition.split('|')[1] || '');
          context.module = {exports: {}};
          load(path);
          const plugin = context.module.exports;
          delete context.module;
          plugin.path = path;
          if (typeof plugin.init === 'function') {
            plugin.init(cfg);
          }
          return plugin;
        })
      : [];

    log(`Using plugins of ${shellToJson(plugins.map((plugin) => plugin.path))}`);

    return {
      execute(methodName, ...args) {
        const applicablePlugins = plugins.filter((plugin) => typeof plugin[methodName] === 'function');
        return applicablePlugins.map((plugin) => plugin[methodName](...args));
      }
    };
  };

  const pluginsRunner = createPluginsRunner(shellContext);
  pluginsRunner.execute('onConfig', config);

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
  const varietyTypeOf = function(thing) {
    if (!arguments.length) { throw new Error('varietyTypeOf() requires an argument'); }

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
          seenElementTypes[varietyTypeOf(item)] = true;
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
  const serializeDoc = (doc, maxDepth, excludeSubkeys) => {
    const result = createKeyMap();

    // Recurse only into plain objects and arrays; BSON wrappers should stay scalar.
    const isHash = (v) => Array.isArray(v) || varietyTypeOf(v) === 'Object';

    const arrayRegex = new RegExp(`\\.${config.arrayEscape}\\d+${config.arrayEscape}\\.`, 'g');

    const serialize = (document, parentKey, depth) => {
      if (parentKey.replace(arrayRegex, '.') in excludeSubkeys) {
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
    serialize(doc, '', maxDepth);
    return result;
  };

  // Convert document to key-value map, where value is always an object with types as keys.
  const analyseDocument = (document) => {
    const result = createKeyMap();
    const arrayRegex = new RegExp(`\\.${config.arrayEscape}\\d+${config.arrayEscape}`, 'g');
    for (const rawKey of Object.keys(document)) {
      const value = document[rawKey];
      const key = rawKey.replace(arrayRegex, `.${config.arrayEscape}`);
      if (typeof result[key] === 'undefined') {
        result[key] = {};
      }
      const type = varietyTypeOf(value);
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

  const mergeDocument = (docResult, interimResults) => {
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

  const convertResults = (interimResults, documentsCount) => {
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
  const reduceDocuments = (accumulator, object) => {
    const docResult = analyseDocument(serializeDoc(object, config.maxDepth, config.excludeSubkeys));
    mergeDocument(docResult, accumulator);
    return accumulator;
  };

  // By default, keys ending in an array index (e.g. "tags.XX") are suppressed,
  // since the parent key already captures the Array type. Set showArrayElements:true
  // to include them — useful for verifying element-type consistency within arrays.
  const arrayRegex = new RegExp(`\\.${config.arrayEscape}$`, 'g');
  const filter = (item) => config.showArrayElements || !item._id.key.match(arrayRegex);

  // Sort desc by totalOccurrences, or by key asc if occurrences are equal.
  const comparator = (a, b) => {
    const countsDiff = b.totalOccurrences - a.totalOccurrences;
    return countsDiff !== 0 ? countsDiff : a._id.key.localeCompare(b._id.key);
  };

  const reduceCursor = (cursor, callback, initialValue) => {
    let result = initialValue;
    cursor.forEach((obj) => {
      result = callback(result, obj);
    });
    return result;
  };

  // limit(0) meant "no limit" in MongoDB ≤7 but is rejected by MongoDB 8+; guard against it.
  let cursor = db.getCollection(config.collection).find(config.query).sort(config.sort);
  if (config.limit > 0) { cursor = cursor.limit(config.limit); }
  const interimResults = reduceCursor(cursor, reduceDocuments, createKeyMap());
  const varietyResults = convertResults(interimResults, countMatchingDocuments(config.collection, config.query, config.limit))
    .filter(filter)
    .sort(comparator);

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

  const createAsciiTable = (results) => {
    const headers = ['key', 'types', 'occurrences', 'percents'];
    if (config.lastValue) {
      headers.push('lastValue');
    }

    // Return the number of decimal places, or 1 for integers (1.23 => 2, 100 => 1, 0.1415 => 4).
    const significantDigits = (value) => {
      const res = value.toString().match(/^[0-9]+\.([0-9]+)$/);
      return res !== null ? res[1].length : 1;
    };

    const maxDigits = varietyResults
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

  const pluginsOutput = pluginsRunner.execute('formatResults', varietyResults);
  if (pluginsOutput.length > 0) {
    pluginsOutput.forEach((output) => print(output));
  } else if (config.outputFormat === 'json') {
    shellPrintJson(varietyResults); // valid formatted json output, compressed variant is printjsononeline()
  } else {
    print(createAsciiTable(varietyResults)); // output nice ascii table with results
  }

}(this)); // end strict mode
