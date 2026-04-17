// SPDX-License-Identifier: MIT
/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any
outliers to that schema. Particularly useful when you inherit a codebase with
data dump and want to quickly learn how the data's structured. Also useful for
finding rare keys.

Please see https://github.com/variety/variety for details.

Released by James Cropcho, © 2012–2026, under the MIT License. */

// -----------------------------------------------------------------------------
// GENERATED FILE — do not edit directly.
//
// Assembled by build.js from:
//   core/formatters/ascii.js, core/formatters/json.js,
//   core/analyzer.js, mongo-shell/adapter.js.
// To change behavior, edit those source files and run `npm run build`. The
// build output is committed so `mongosh variety.js` works from a fresh clone
// without a build step; CI verifies the committed file matches its sources.
// -----------------------------------------------------------------------------

// JavaScript compatibility floor: this file runs inside a MongoDB shell —
// either mongosh (all versions, modern V8) or the legacy `mongo` shell
// (SpiderMonkey-based, shipped through MongoDB 5.x). The lowest common
// denominator is the ES6+ feature set available in the legacy shell since
// MongoDB 4.4: let/const, arrow functions, template literals, rest/spread,
// for…of, Object.keys()/Object.entries(), and class. Later additions such
// as Object.hasOwn() (ES2022) are absent and must not be used here.
// See .eslint.config.js for the enforced rule set.

// -----------------------------------------------------------------------------
// This file is organized in four sections, sourced from four separate files:
//
//   1. FORMATTER SECTION (core/formatters/ascii.js, core/formatters/json.js) —
//      built-in output formatters. Each is a self-contained IIFE that registers
//      a factory function on `shellContext.__varietyFormatters`. Third-party
//      formatters can be supplied as plugins instead (see README).
//
//   2. IMPLEMENTATION SECTION (core/analyzer.js) — pure, transport-agnostic
//      analysis logic. Functions take their dependencies (config, and where
//      needed a `log` function or a `deps` bag holding shell primitives)
//      as explicit parameters. The section hands a bundle of functions to
//      the interface section via `shellContext.__varietyImpl`.
//
//   3. INTERFACE SECTION (mongo-shell/adapter.js) — everything that touches
//      shell globals: reading input (`collection`, `plugins`, `__quiet`,
//      `slaveOk`, etc.), the config-echo logging, plugin loading via
//      `load()`, input validation, and constructing the dependency bag
//      passed to `impl.run()`.
//
// The handoff properties are deleted at the end so the build is idempotent and
// does not pollute the shell's global namespace after execution.
// -----------------------------------------------------------------------------


// SPDX-License-Identifier: MIT
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


// SPDX-License-Identifier: MIT
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


// SPDX-License-Identifier: MIT
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


// SPDX-License-Identifier: MIT
// =============================================================================
// INTERFACE SECTION
// =============================================================================
(function (shellContext) {
  'use strict'; // wraps everything for which we can use strict mode ―JC

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const impl = shellContext.__varietyImpl;

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

  const countMatchingDocuments = (collectionName, query, limit) => {
    const coll = db.getCollection(collectionName);
    const options = (typeof limit === 'number' && limit > 0) ? {limit} : undefined;
    return coll.countDocuments(query, options);
  };

  log('Variety: A MongoDB Schema Analyzer');
  log('Version 1.5.2, released 30 September 2025');

  if (typeof slaveOk !== 'undefined') {
    if (slaveOk === true) {
      db.getMongo().setSlaveOk();
    }
  }

  const selectedDatabaseName = db.getName();
  const knownDatabases = db.adminCommand('listDatabases').databases;
  const knownDatabaseNames = [];
  if (typeof knownDatabases !== 'undefined') { // not authorized user receives error response (json) without databases key
    // Keep validation scoped to the selected database. Issue #145
    // (@pkgajulapalli) hit a startup failure while enumerating collections for
    // an unrelated database.
    knownDatabases.forEach((database) => {
      if (typeof database.name === 'string' && database.name.length > 0) {
        knownDatabaseNames.push(database.name);
      }
    });

    if (!knownDatabaseNames.includes(selectedDatabaseName)) {
      throw new Error(`The database specified (${selectedDatabaseName}) does not exist.\n` +
          `Possible database options are: ${knownDatabaseNames.join(', ')}.`);
    }
  }

  const collectionNames = db.getCollectionNames();
  const collNames = collectionNames.join(', ');
  if (collectionNames.length === 0) {
    throw new Error(`The database specified (${selectedDatabaseName}) is empty.\n` +
        `Possible database options are: ${knownDatabaseNames.join(', ')}.`);
  }

  if (typeof collection === 'undefined') {
    throw new Error('You have to supply a \'collection\' variable, à la --eval \'var collection = "animals"\'.\n' +
        `Possible collection options for database specified: ${collNames}.\n` +
        'Please see https://github.com/variety/variety for details.');
  }

  if (countMatchingDocuments(collection, {}) === 0) {
    throw new Error(`The collection specified (${collection}) in the database specified (${db.getName()}) does not exist or is empty.\n` +
        `Possible collection options for database specified: ${collNames}.`);
  }

  const readConfig = (configProvider) => {
    const config = {};
    const read = (name, defaultValue) => {
      const value = typeof configProvider[name] !== 'undefined' ? configProvider[name] : defaultValue;
      config[name] = value;
      log(`Using ${name} of ${impl.shellToJson(value)}`);
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
    }, impl.createKeyMap());

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

    log(`Using plugins of ${impl.shellToJson(plugins.map((plugin) => plugin.path))}`);

    return {
      execute(methodName, ...args) {
        const applicablePlugins = plugins.filter((plugin) => typeof plugin[methodName] === 'function');
        return applicablePlugins.map((plugin) => plugin[methodName](...args));
      }
    };
  };

  const pluginsRunner = createPluginsRunner(shellContext);
  pluginsRunner.execute('onConfig', config);

  impl.run(config, pluginsRunner, {
    db,
    connect: typeof connect !== 'undefined' ? connect : undefined,
    log,
    print,
    countMatchingDocuments,
  });

  // Clean up the implementation handoffs so repeated loads remain idempotent
  // and no ad hoc internals leak onto globalThis after execution.
  delete shellContext.__varietyImpl;
  delete shellContext.__varietyFormatters;
}(this)); // end strict mode
