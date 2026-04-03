/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any
outliers to that schema. Particularly useful when you inherit a codebase with
data dump and want to quickly learn how the data's structured. Also useful for
finding rare keys.

Please see https://github.com/variety/variety for details.

Released by James Cropcho, © 2012–2026, under the MIT License. */

(function () {
  'use strict'; // wraps everything for which we can use strict mode ―JC

  var shellContext = typeof globalThis !== 'undefined' ? globalThis : Function('return this')();

  var shellIsQuiet = function() {
    if (typeof __quiet !== 'undefined' && __quiet) {
      return true;
    }

    return typeof process !== 'undefined' &&
      process &&
      process.argv &&
      process.argv.indexOf('--quiet') !== -1;
  };

  var log = function(message) {
    if(!shellIsQuiet()) {
      print(message);
    }
  };

  var shellToJson = function(value) {
    if (typeof tojson === 'function') {
      return tojson(value);
    }

    return JSON.stringify(value);
  };

  var shellPrintJson = function(value) {
    print(JSON.stringify(value, null, 2));
  };

  var getDatabase = function(name) {
    if (typeof db.getSisterDB === 'function') {
      return db.getSisterDB(name);
    }

    return db.getMongo().getDB(name);
  };

  log('Variety: A MongoDB Schema Analyzer');
  log('Version 1.5.1, released 02 October 2017');

  var dbs = [];
  var emptyDbs = [];

  if (typeof slaveOk !== 'undefined') {
    if (slaveOk === true) {
      db.getMongo().setSlaveOk();
    }
  }

  var knownDatabases = db.adminCommand('listDatabases').databases;
  if(typeof knownDatabases !== 'undefined') { // not authorized user receives error response (json) without databases key
    knownDatabases.forEach(function(d){
      if(getDatabase(d.name).getCollectionNames().length > 0) {
        dbs.push(d.name);
      }
      if(getDatabase(d.name).getCollectionNames().length === 0) {
        emptyDbs.push(d.name);
      }
    });

    if (emptyDbs.indexOf(db.getName()) !== -1) {
      throw 'The database specified ('+ db.getName() +') is empty.\n'+
          'Possible database options are: ' + dbs.join(', ') + '.';
    }

    if (dbs.indexOf(db.getName()) === -1) {
      throw 'The database specified ('+ db.getName() +') does not exist.\n'+
          'Possible database options are: ' + dbs.join(', ') + '.';
    }
  }

  var collNames = db.getCollectionNames().join(', ');
  if (typeof collection === 'undefined') {
    throw 'You have to supply a \'collection\' variable, à la --eval \'var collection = "animals"\'.\n'+
        'Possible collection options for database specified: ' + collNames + '.\n'+
        'Please see https://github.com/variety/variety for details.';
  }

  function countMatchingDocuments(collectionName, query, limit) {
    var coll = db.getCollection(collectionName);

    if (typeof coll.countDocuments === 'function') {
      var options = typeof limit === 'number' ? {limit: limit} : undefined;
      return coll.countDocuments(query, options);
    }

    var cursor = coll.find(query);
    if (typeof limit === 'number') {
      cursor = cursor.limit(limit);
    }

    return cursor.count();
  }

  if (countMatchingDocuments(collection, {}) === 0) {
    throw 'The collection specified (' + collection + ') in the database specified ('+ db.getName() +') does not exist or is empty.\n'+
        'Possible collection options for database specified: ' + collNames + '.';
  }

  var readConfig = function(configProvider) {
    var config = {};
    var read = function(name, defaultValue) {
      var value = typeof configProvider[name] !== 'undefined' ? configProvider[name] : defaultValue;
      config[name] = value;
      log('Using '+name+' of ' + shellToJson(value));
    };
    read('collection', null);
    read('query', {});
    read('limit', countMatchingDocuments(config.collection, config.query));
    read('maxDepth', 99);
    read('sort', {_id: -1});
    read('outputFormat', 'ascii');
    read('persistResults', false);
    read('resultsDatabase', 'varietyResults');
    read('resultsCollection', collection + 'Keys');
    read('resultsUser', null);
    read('resultsPass', null);
    read('logKeysContinuously', false);
    read('excludeSubkeys', []);
    read('arrayEscape', 'XX');
    read('lastValue', false);

    // Translate excludeSubkeys into a set-like object for compatibility.
    config.excludeSubkeys = config.excludeSubkeys.reduce(function (result, item) { result[item+'.'] = true; return result; }, {});

    return config;
  };

  var config = readConfig(shellContext);

  var createPluginsRunner = function(context) {
    var parsePath = function(val) { return val.slice(-3) !== '.js' ? val + '.js' : val;};
    var parseConfig = function(val) {
      var config = {};
      val.split('&').reduce(function(acc, val) {
        var parts = val.split('=');
        acc[parts[0]] = parts[1];
        return acc;
      }, config);
      return config;
    };

    var plugins;

    if(typeof context.plugins !== 'undefined') {
      plugins = context.plugins.split(',')
        .map(function(path){return path.trim();})
        .map(function(definition){
          var path = parsePath(definition.split('|')[0]);
          var config = parseConfig(definition.split('|')[1] || '');
          context.module = {exports: {}};
          load(path);
          var plugin = context.module.exports;
          delete context.module;
          plugin.path = path;
          if(typeof plugin.init === 'function') {
            plugin.init(config);
          }
          return plugin;
        });
    } else {
      plugins = [];
    }

    log('Using plugins of ' + shellToJson(plugins.map(function(plugin){return plugin.path;})));

    return {
      execute: function(methodName) {
        var args = Array.prototype.slice.call(arguments, 1);
        var applicablePlugins = plugins.filter(function(plugin){return typeof plugin[methodName] === 'function';});
        return applicablePlugins.map(function(plugin) {
          return plugin[methodName].apply(plugin, args);
        });
      }
    };
  };

  var pluginsRunner = createPluginsRunner(shellContext);
  pluginsRunner.execute('onConfig', config);

  var getBinDataSubtype = function(binData) {
    if (binData && typeof binData.subtype === 'function') {
      return binData.subtype();
    }
    if (binData && typeof binData.sub_type !== 'undefined') {
      return binData.sub_type;
    }
    return undefined;
  };

  var getBinDataHex = function(binData) {
    if (binData && typeof binData.hex === 'function') {
      return binData.hex();
    }
    if (binData && typeof Buffer !== 'undefined' && binData.buffer) {
      return Buffer.from(binData.buffer).toString('hex');
    }
    return shellToJson(binData);
  };

  var varietyTypeOf = function(thing) {
    if (!arguments.length) { throw 'varietyTypeOf() requires an argument'; }

    if (typeof thing === 'undefined') {
      return 'undefined';
    } else if (typeof thing !== 'object') {
    // the messiness below capitalizes the first letter, so the output matches
    // the other return values below. ―JC
      var typeofThing = typeof thing; // edgecase of JSHint's "singleGroups"
      return typeofThing[0].toUpperCase() + typeofThing.slice(1);
    } else {
      if (Array.isArray(thing)) {
        return 'Array';
      } else if (thing === null) {
        return 'null';
      } else if (thing instanceof Date) {
        return 'Date';
      } else if(thing instanceof NumberLong) {
        return 'NumberLong';
      } else if (thing instanceof ObjectId) {
        return 'ObjectId';
      } else if (thing instanceof BinData) {
        var binDataTypes = {};
        binDataTypes[0x00] = 'generic';
        binDataTypes[0x01] = 'function';
        binDataTypes[0x02] = 'old';
        binDataTypes[0x03] = 'UUID';
        binDataTypes[0x04] = 'UUID';
        binDataTypes[0x05] = 'MD5';
        binDataTypes[0x80] = 'user';
        return 'BinData-' + binDataTypes[getBinDataSubtype(thing)];
      } else {
        return 'Object';
      }
    }
  };

  //flattens object keys to 1D. i.e. {'key1':1,{'key2':{'key3':2}}} becomes {'key1':1,'key2.key3':2}
  //we assume no '.' characters in the keys, which is an OK assumption for MongoDB
  var serializeDoc = function(doc, maxDepth, excludeSubkeys) {
    var result = {};

    //determining if an object is a Hash vs Array vs something else is hard
    //returns true, if object in argument may have nested objects and makes sense to analyse its content
    function isHash(v) {
      var isArray = Array.isArray(v);
      var isObject = typeof v === 'object';
      var specialObject = v instanceof Date ||
                        v instanceof ObjectId ||
                        v instanceof BinData ||
                        v instanceof NumberLong;
      return !specialObject && (isArray || isObject);
    }

    var arrayRegex = new RegExp('\\.' + config.arrayEscape + '\\d+' + config.arrayEscape + '\\.', 'g');

    function serialize(document, parentKey, maxDepth) {
      if(Object.prototype.hasOwnProperty.call(excludeSubkeys, parentKey.replace(arrayRegex, '.')))
        return;
      for(var key in document) {
        //skip over inherited properties such as string, length, etc.
        if(!Object.prototype.hasOwnProperty.call(document, key)) {
          continue;
        }
        var value = document[key];
        if(Array.isArray(document))
          key = config.arrayEscape + key + config.arrayEscape; //translate unnamed object key from {_parent_name_}.{_index_} to {_parent_name_}.arrayEscape{_index_}arrayEscape.
        result[parentKey+key] = value;
        // Recurse into nested objects only if we have not reached max depth.
        if(isHash(value) && maxDepth > 1) {
          serialize(value, parentKey+key+'.', maxDepth-1);
        }
      }
    }
    serialize(doc, '', maxDepth);
    return result;
  };

  // convert document to key-value map, where value is always an array with types as plain strings
  var analyseDocument = function(document) {
    var result = {};
    var arrayRegex = new RegExp('\\.' + config.arrayEscape + '\\d+' + config.arrayEscape, 'g');
    for (var key in document) {
      var value = document[key];
      key = key.replace(arrayRegex, '.' + config.arrayEscape);
      if(typeof result[key] === 'undefined') {
        result[key] = {};
      }
      var type = varietyTypeOf(value);
      result[key][type] = null;

      if(config.lastValue){
        if (type in {'String': true, 'Boolean': true}) {
          result[key][type] = value.toString();
        }else if (type in {'Number': true, 'NumberLong': true}) {
          result[key][type] = value.valueOf();
        }else if(type == 'ObjectId'){
          result[key][type] = value.str;
        }else if(type === 'Date'){
          result[key][type] = new Date(value).getTime();
        }else if(type.startsWith('BinData')){
          result[key][type] = getBinDataHex(value);
        }
      }
    }

    return result;
  };

  var mergeDocument = function(docResult, interimResults) {
    for (var key in docResult) {
      if(key in interimResults) {
        var existing = interimResults[key];

        for(var type in docResult[key]) {
          if (type in existing.types) {
            existing.types[type] = existing.types[type] + 1;
          } else {
            existing.types[type] = 1;
            if (config.logKeysContinuously) {
              log('Found new key type "' + key + '" type "' + type + '"');
            }
          }
        }
        existing.totalOccurrences = existing.totalOccurrences + 1;
      } else {
        var lastValue = null;
        var types = {};
        for (var newType in docResult[key]) {
          types[newType] = 1;
          lastValue = docResult[key][newType];
          if (config.logKeysContinuously) {
            log('Found new key type "' + key + '" type "' + newType + '"');
          }
        }
        interimResults[key] = {'types': types,'totalOccurrences':1};
        if (config.lastValue) {
          interimResults[key]['lastValue'] = lastValue ? lastValue : '['+newType+']';
        }
      }
    }
  };

  var convertResults = function(interimResults, documentsCount) {
    var getKeys = function(obj) {
      var keys = {};
      for(var key in obj) {
        keys[key] = obj[key];
      }
      return keys;
    //return keys.sort();
    };
    var varietyResults = [];
    //now convert the interimResults into the proper format
    for(var key in interimResults) {
      var entry = interimResults[key];

      var obj = {
        '_id': {'key':key},
        'value': {'types':getKeys(entry.types)},
        'totalOccurrences': entry.totalOccurrences,
        'percentContaining': entry.totalOccurrences * 100 / documentsCount
      };

      if(config.lastValue){
        obj.lastValue = entry.lastValue;
      }

      varietyResults.push(obj);
    }
    return varietyResults;
  };

  // Merge the keys and types of current object into accumulator object
  var reduceDocuments = function(accumulator, object) {
    var docResult = analyseDocument(serializeDoc(object, config.maxDepth, config.excludeSubkeys));
    mergeDocument(docResult, accumulator);
    return accumulator;
  };

  // We throw away keys which end in an array index, since they are not useful
  // for our analysis. (We still keep the key of their parent array, though.) ―JC
  var arrayRegex = new RegExp('\\.' + config.arrayEscape + '$', 'g');
  var filter = function(item) {
    return !item._id.key.match(arrayRegex);
  };

  // sort desc by totalOccurrences or by key asc if occurrences equal
  var comparator = function(a, b) {
    var countsDiff = b.totalOccurrences - a.totalOccurrences;
    return countsDiff !== 0 ? countsDiff : a._id.key.localeCompare(b._id.key);
  };

  var reduceCursor = function(cursor, callback, initialValue) {
    var result = initialValue;
    cursor.forEach(function(obj){
      result = callback(result, obj);
    });
    return result;
  };

  var cursor = db.getCollection(config.collection).find(config.query).sort(config.sort).limit(config.limit);
  var interimResults = reduceCursor(cursor, reduceDocuments, {});
  var varietyResults = convertResults(interimResults, countMatchingDocuments(config.collection, config.query, config.limit))
    .filter(filter)
    .sort(comparator);

  if(config.persistResults) {
    var resultsDB;
    var resultsCollectionName = config.resultsCollection;

    if (config.resultsDatabase.indexOf('/') === -1) {
    // Local database; don't reconnect
      resultsDB = db.getMongo().getDB(config.resultsDatabase);
    } else {
    // Remote database, establish new connection
      resultsDB = connect(config.resultsDatabase);
    }

    if (config.resultsUser !== null && config.resultsPass !== null) {
      resultsDB.auth(config.resultsUser, config.resultsPass);
    }

    // replace results collection
    log('replacing results collection: '+ resultsCollectionName);
    resultsDB.getCollection(resultsCollectionName).drop();
    resultsDB.getCollection(resultsCollectionName).insert(varietyResults);
  }

  var createAsciiTable = function(results) {
    var headers = ['key', 'types', 'occurrences', 'percents'];
    if (config.lastValue) {
      headers.push('lastValue');
    }

    // return the number of decimal places or 1, if the number is int (1.23=>2, 100=>1, 0.1415=>4)
    var significantDigits = function(value) {
      var res = value.toString().match(/^[0-9]+\.([0-9]+)$/);
      return res !== null ? res[1].length : 1;
    };

    var maxDigits = varietyResults.map(function(value){return significantDigits(value.percentContaining);}).reduce(function(acc,val){return acc>val?acc:val;});

    var rows = results.map(function(row) {
      var types = [];
      var typeKeys = Object.keys(row.value.types);
      if (typeKeys.length > 1) {
        for (var type in row.value.types) {
          var typestring = type + ' (' + row.value.types[type] + ')';
          types.push(typestring);
        }
      } else {
        types = typeKeys;
      }

      var rawArray = [row._id.key, types, row.totalOccurrences, row.percentContaining.toFixed(Math.min(maxDigits, 20))];
      if (config.lastValue && row['lastValue']) {
        rawArray.push(row['lastValue']);
      }
      return rawArray;
    });
    var table = [headers, headers.map(function(){return '';})].concat(rows);
    var colMaxWidth = function(arr, index) {return Math.max.apply(null, arr.map(function(row){return row[index] ? row[index].toString().length : 0;}));};
    var pad = function(width, string, symbol) { return width <= string.length ? string : pad(width, isNaN(string) ? string + symbol : symbol + string, symbol); };
    table = table.map(function(row, ri){
      return '| ' + row.map(function(cell, i) {return pad(colMaxWidth(table, i), cell.toString(), ri === 1 ? '-' : ' ');}).join(' | ') + ' |';
    });
    var border = '+' + pad(table[0].length - 2, '', '-') + '+';
    return [border].concat(table).concat(border).join('\n');
  };

  var pluginsOutput = pluginsRunner.execute('formatResults', varietyResults);
  if (pluginsOutput.length > 0) {
    pluginsOutput.forEach(function(i){print(i);});
  } else if(config.outputFormat === 'json') {
    shellPrintJson(varietyResults); // valid formatted json output, compressed variant is printjsononeline()
  } else {
    print(createAsciiTable(varietyResults)); // output nice ascii table with results
  }

}()); // end strict mode
