/* Variety: A MongoDB Schema Analyzer 

This tool helps you get a sense of your application's schema, as well as any
outliers to that schema. Particularly useful when you inherit a codebase with
data dump and want to quickly learn how the data's structured. Also useful for
finding rare keys.

Please see https://github.com/variety/variety for details.

Released by Maypop Inc, © 2012-2015, under the MIT License. */

(function () { 'use strict'; // wraps everything for which we can use strict mode -JC

var log = function(message) {
  if(!__quiet) { // mongo shell param, coming from https://github.com/mongodb/mongo/blob/5fc306543cd3ba2637e5cb0662cc375f36868b28/src/mongo/shell/dbshell.cpp#L624
      print(message);
    }
};

log('Variety: A MongoDB Schema Analyzer');
log('Version 1.5.0, released 14 May 2015');

var dbs = [];
var emptyDbs = [];

var knownDatabases = db.adminCommand('listDatabases').databases;
if(typeof knownDatabases !== 'undefined') { // not authorized user receives error response (json) without databases key
  knownDatabases.forEach(function(d){
    if(db.getSisterDB(d.name).getCollectionNames().length > 0) {
      dbs.push(d.name);
    }
    if(db.getSisterDB(d.name).getCollectionNames().length === 0) {
      emptyDbs.push(d.name);
    }
  });

  if (emptyDbs.indexOf(db.getName()) !== -1) {
    throw 'The database specified ('+ db +') is empty.\n'+
          'Possible database options are: ' + dbs.join(', ') + '.';
  }

  if (dbs.indexOf(db.getName()) === -1) {
    throw 'The database specified ('+ db +') does not exist.\n'+
          'Possible database options are: ' + dbs.join(', ') + '.';
  }
}

var collNames = db.getCollectionNames().join(', ');
if (typeof collection === 'undefined') {
  throw 'You have to supply a \'collection\' variable, à la --eval \'var collection = "animals"\'.\n'+
        'Possible collection options for database specified: ' + collNames + '.\n'+
        'Please see https://github.com/variety/variety for details.';
}

if (db[collection].count() === 0) {
  throw 'The collection specified (' + collection + ') in the database specified ('+ db +') does not exist or is empty.\n'+
        'Possible collection options for database specified: ' + collNames + '.';
}

var readConfig = function(configProvider) {
  var config = {};
  var read = function(name, defaultValue) {
    var value = typeof configProvider[name] !== 'undefined' ? configProvider[name] : defaultValue;
    config[name] = value;
    log('Using '+name+' of ' + tojson(value));
  };
  read('collection', null);
  read('query', {});
  read('limit', db[config.collection].find(config.query).count());
  read('maxDepth', 99);
  read('sort', {_id: -1});
  read('outputFormat', 'ascii');
  read('persistResults', false);
  return config;
};

var config = readConfig(this);

var PluginsClass = function(context) {
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

  if(typeof context.plugins !== 'undefined') {
    this.plugins = context.plugins.split(',')
      .map(function(path){return path.trim();})
      .map(function(definition){
        var path = parsePath(definition.split('|')[0]);
        var config = parseConfig(definition.split('|')[1] || '');
        context.module = context.module || {};
        load(path);
        var plugin = context.module.exports;
        plugin.path = path;
        if(typeof plugin.init === 'function') {
          plugin.init(config);
        }
        return plugin;
      }, this);
  } else {
    this.plugins = [];
  }

  this.execute = function(methodName) {
    var args = Array.prototype.slice.call(arguments, 1);
    var applicablePlugins = this.plugins.filter(function(plugin){return typeof plugin[methodName] === 'function';});
    return applicablePlugins.map(function(plugin) {
      return plugin[methodName].apply(plugin, args);
    });
  };

  log('Using plugins of ' + tojson(this.plugins.map(function(plugin){return plugin.path;})));
};

var $plugins = new PluginsClass(this);
$plugins.execute('onConfig', config);

var varietyTypeOf = function(thing) {
  if (typeof thing === 'undefined') { throw 'varietyTypeOf() requires an argument'; }

  if (typeof thing !== 'object') {
    // the messiness below capitalizes the first letter, so the output matches
    // the other return values below. -JC
    var typeofThing = typeof thing; // edgecase of JSHint's "singleGroups"
    return typeofThing[0].toUpperCase() + typeofThing.slice(1);
  }
  else {
    if (thing && thing.constructor === Array) {
      return 'Array';
    }
    else if (thing === null) {
      return 'null';
    }
    else if (thing instanceof Date) {
      return 'Date';
    }
    else if (thing instanceof ObjectId) {
      return 'ObjectId';
    }
    else if (thing instanceof BinData) {
      var binDataTypes = {};
      binDataTypes[0x00] = 'generic';
      binDataTypes[0x01] = 'function';
      binDataTypes[0x02] = 'old';
      binDataTypes[0x03] = 'UUID';
      binDataTypes[0x05] = 'MD5';
      binDataTypes[0x80] = 'user';
      return 'BinData-' + binDataTypes[thing.subtype()];
    } else {
      return 'Object';
    }
  }
};

//flattens object keys to 1D. i.e. {'key1':1,{'key2':{'key3':2}}} becomes {'key1':1,'key2.key3':2}
//we assume no '.' characters in the keys, which is an OK assumption for MongoDB
var serializeDoc = function(doc, maxDepth) {
  var result = {};

  //determining if an object is a Hash vs Array vs something else is hard
  //returns true, if object in argument may have nested objects and makes sense to analyse its content
  function isHash(v) {
    var isArray = Array.isArray(v);
    var isObject = typeof v === 'object';
    var specialObject = v instanceof Date ||
                        v instanceof ObjectId ||
                        v instanceof BinData;
    return !specialObject && (isArray || isObject);
  }

  function serialize(document, parentKey, maxDepth){
    for(var key in document){
      //skip over inherited properties such as string, length, etch
      if(!document.hasOwnProperty(key)) {
        continue;
      }
      var value = document[key];
      //objects are skipped here and recursed into later
      //if(typeof value != 'object')
      result[parentKey+key] = value;
      //it's an object, recurse...only if we haven't reached max depth
      if(isHash(value) && maxDepth > 1) {
        serialize(value, parentKey+key+'.',maxDepth-1);
      }
    }
  }
  serialize(doc, '', maxDepth);
  return result;
};

// convert document to key-value map, where value is always an array with types as plain strings
var analyseDocument = function(document) {
  var result = {};
  for (var key in document) {
    var value = document[key];
    //translate unnamed object key from {_parent_name_}.{_index_} to {_parent_name_}.XX
    key = key.replace(/\.\d+/g,'.XX');
    if(typeof result[key] === 'undefined') {
      result[key] = {};
    }
    var type = varietyTypeOf(value);
    result[key][type] = 1;
  }
  return result;
};

var mergeDocument = function(docResult, interimResults) {
  for (var key in docResult) {
    if(key in interimResults) {
      var existing = interimResults[key];
      for(var type in docResult[key]) {
        if (existing.types[type]) {
          existing.types[type] += 1;
        } else {
          existing.types[type] = 1;
        }
      }
      existing.totalOccurrences = existing.totalOccurrences + 1;
    } else {
      interimResults[key] = {'types':docResult[key],'totalOccurrences':1};
    }
  }
};

var convertResults = function(interimResults, documentsCount) {
  var getKeys = function(obj) {
    var keys = [];
    var types = obj.types
    var totalOccurrences = obj.totalOccurrences
    for(var key in types) {
      keys.push(key + ' (' + ((types[key] * 100 / totalOccurrences).toPrecision(3)).toString() + '%)');
    }
    return keys.sort();
  };
  var varietyResults = [];
  //now convert the interimResults into the proper format
  for(var key in interimResults) {
    var entry = interimResults[key];
    varietyResults.push({
        '_id': {'key':key},
        'value': {'types':getKeys(entry)},
        'totalOccurrences': entry.totalOccurrences,
        'percentContaining': entry.totalOccurrences * 100 / documentsCount
    });
  }
  return varietyResults;
};

// Merge the keys and types of current object into accumulator object
var reduceDocuments = function(accumulator, object) {
  var docResult = analyseDocument(serializeDoc(object, config.maxDepth));
  mergeDocument(docResult, accumulator);
  return accumulator;
};

// We throw away keys which end in an array index, since they are not useful
// for our analysis. (We still keep the key of their parent array, though.) -JC
var filter = function(item) {
  return !item._id.key.match(/\.XX$/);
};

// sort desc by totalOccurrences or by key asc if occurrences equal
var comparator = function(a, b) {
  var countsDiff = b.totalOccurrences - a.totalOccurrences;
  return countsDiff !== 0 ? countsDiff : a._id.key.localeCompare(b._id.key);
};

// extend standard MongoDB cursor of reduce method - call forEach and combine the results
DBQuery.prototype.reduce = function(callback, initialValue) {
  var result = initialValue;
  this.forEach(function(obj){
    result = callback(result, obj);
  });
  return result;
};

var cursor = db[config.collection].find(config.query).sort(config.sort).limit(config.limit);
var interimResults = cursor.reduce(reduceDocuments, {});
var varietyResults = convertResults(interimResults, cursor.size())
  .filter(filter)
  .sort(comparator);

if(config.persistResults) {
  var resultsDB = db.getMongo().getDB('varietyResults');
  var resultsCollectionName = collection + 'Keys';

  // replace results collection
  log('creating results collection: '+resultsCollectionName);
  resultsDB[resultsCollectionName].drop();
  resultsDB[resultsCollectionName].insert(varietyResults);
}

var createAsciiTable = function(results) {
  var headers = ['key', 'types', 'occurrences', 'percents'];
  // return the number of decimal places or 1, if the number is int (1.23=>2, 100=>1, 0.1415=>4)
  var significantDigits = function(value) {
    var res = value.toString().match(/^[0-9]+\.([0-9]+)$/);
    return res !== null ? res[1].length : 1;
  };

  var maxDigits = varietyResults.map(function(value){return significantDigits(value.percentContaining);}).reduce(function(acc,val){return acc>val?acc:val;});

  var rows = results.map(function(row) {
    return [row._id.key, row.value.types, row.totalOccurrences, row.percentContaining.toFixed(maxDigits)];
  });
  var table = [headers, headers.map(function(){return '';})].concat(rows);
  var colMaxWidth = function(arr, index) {return Math.max.apply(null, arr.map(function(row){return row[index].toString().length;}));};
  var pad = function(width, string, symbol) { return width <= string.length ? string : pad(width, isNaN(string) ? string + symbol : symbol + string, symbol); };
  table = table.map(function(row, ri){
    return '| ' + row.map(function(cell, i) {return pad(colMaxWidth(table, i), cell.toString(), ri === 1 ? '-' : ' ');}).join(' | ') + ' |';
  });
  var border = '+' + pad(table[0].length - 2, '', '-') + '+';
  return [border].concat(table).concat(border).join('\n');
};

var pluginsOutput = $plugins.execute('formatResults', varietyResults);
if (pluginsOutput.length > 0) {
  pluginsOutput.forEach(function(i){print(i);});
} else if(config.outputFormat === 'json') {
  printjson(varietyResults); // valid formatted json output, compressed variant is printjsononeline()
} else {
   print(createAsciiTable(varietyResults)); // output nice ascii table with results
}

}.bind(this)()); // end strict mode
