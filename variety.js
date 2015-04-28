/*jshint bitwise: false*/
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
log('Version 1.4.1, released 14 Oct 2014');

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

var $query = {};
if(typeof query !== 'undefined') {
  $query = query;
  query = '_undefined';
}
log('Using query of ' + tojson($query));

var $limit = db[collection].find($query).count();
if(typeof limit !== 'undefined') {
  $limit = limit;
  limit = '_undefined';
}
log('Using limit of ' + $limit);

var $maxDepth = 99;
if(typeof maxDepth !== 'undefined') {
  $maxDepth = maxDepth;
  maxDepth = '_undefined';
}
log('Using maxDepth of ' + $maxDepth);

var $sort = {_id: -1};
if(typeof sort !== 'undefined') {
  $sort = sort;
  sort = '_undefined';
}
log('Using sort of ' + tojson($sort));

var $outputFormat = 'ascii';
if(typeof outputFormat !== 'undefined') {
  $outputFormat = outputFormat;
  outputFormat = '_undefined';
}
log('Using outputFormat of ' + $outputFormat);


var $numColumns = 4;
if(typeof numColumns !== 'undefined') {
    $numColumns = numColumns;
    numColumns = '_undefined';
}
log('Using numColumns of ' + $numColumns);

var $persistResults = false;
if(typeof persistResults !== 'undefined') {
  $persistResults = persistResults;
  persistResults = '_undefined';
}
log('Using persistResults of ' + $persistResults);

log('Using collection of ' + collection);

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
    result[key][type] = true;
  }
  return result;
};

var mergeDocument = function(docResult, interimResults) {
  for (var key in docResult) {
    if(key in interimResults) {
      var existing = interimResults[key];
      for(var type in docResult[key]) {
        existing.types[type] = true;
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
    for(var key in obj) {
      keys.push(key);
    }
    return keys.sort();
  };
  var varietyResults = [];
  //now convert the interimResults into the proper format
  for(var key in interimResults) {
    var entry = interimResults[key];
    varietyResults.push({
        '_id': {'key':key},
        'value': {'types':getKeys(entry.types)},
        'totalOccurrences': entry.totalOccurrences,
        'percentContaining': entry.totalOccurrences * 100 / documentsCount
    });
  }
  return varietyResults;
};

// Merge the keys and types of current object into accumulator object
var reduceDocuments = function(accumulator, object) {
  var docResult = analyseDocument(serializeDoc(object, $maxDepth));
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

var cursor = db[collection].find($query).sort($sort).limit($limit);
var interimResults = cursor.reduce(reduceDocuments, {});
var varietyResults = convertResults(interimResults, cursor.size())
  .filter(filter)
  .sort(comparator);

if($persistResults) {
  var resultsDB = db.getMongo().getDB('varietyResults');
  var resultsCollectionName = collection + 'Keys';

  // replace results collection
  log('creating results collection: '+resultsCollectionName);
  resultsDB[resultsCollectionName].drop();
  resultsDB[resultsCollectionName].insert(varietyResults);
}

  var table, maxDigits, output, significantDigits;
if($outputFormat === 'json') {
  printjson(varietyResults); // valid formatted json output, compressed variant is printjsononeline()

}else if($outputFormat === 'latex') {  // output nice latex table with results
  table = [['key', 'types', 'occurrences', 'percents']]; // header row
  // return the number of decimal places or 1, if the number is int (1.23=>2, 100=>1, 0.1415=>4)
  significantDigits = function (value) {
    var res = value.toString().match(/^[0-9]+\.([0-9]+)$/);
    return res !== null ? res[1].length : 1;
  };

  maxDigits = Math.max.apply(null, varietyResults.map(function (value) {
    return significantDigits(value.percentContaining);
  }));

  varietyResults.forEach(function (key) {
    table.push([key._id.key, key.value.types.toString(), key.totalOccurrences.toString(), key.percentContaining.toFixed(maxDigits).toString()]);
  });

  // setup up the document
  output = '\\documentclass[11pt,twoside,a4paper]{article}\n\n\\begin{document}\n' +
      '    \\begin{center}\n' +
      '         \\begin{tabular}{|';

  //Add justifications programmatically
  for (var i = 0; i < $numColumns; i++) {
     output+= ' c |';
  }
  output += '}\n           \\hline\n';

  table.forEach(function(row,ri){
    //Padding
    output += '            ';
    /** _id needs escaping for latex, in the final column no need for trailing &
     * Cut down the columns by returning space, or what should be returned
     * @type {string}
     */
    output += row.map(function(cell, i) {return i >= $numColumns ? '' : (i === 0 && ri === 1 ? '\\' + cell : cell) +
                                                                 (i >= $numColumns - 1 ? ' ' : ' & ');}).join(' ');
    output +=' \\\\ \\hline \n';
  });

  output += '        \\end{tabular}\n' +
            '    \\end{center}\n'+
            '\\end{document}';

  print(output);

}else{  // output nice ascii table with results
   table = [['key', 'types', 'occurrences', 'percents'], ['', '', '', '']]; // header + delimiter rows

   // return the number of decimal places or 1, if the number is int (1.23=>2, 100=>1, 0.1415=>4)
    significantDigits = function(value) {
      var res = value.toString().match(/^[0-9]+\.([0-9]+)$/);
      return res !== null ? res[1].length : 1;
    };

  maxDigits = Math.max.apply(null, varietyResults.map(function(value){return significantDigits(value.percentContaining);}));

  varietyResults.forEach(function(key) {
    table.push([key._id.key, key.value.types.toString(), key.totalOccurrences.toString(), key.percentContaining.toFixed(maxDigits).toString()]);
  });

  var colMaxWidth = function(arr, index) {
   return Math.max.apply(null, arr.map(function(row){return row[index].toString().length;}));
  };

  var pad = function(width, string, symbol) { return width <= string.length ? string : pad(width, isNaN(string) ? string + symbol : symbol + string, symbol); };

  output = '';
  table.forEach(function(row, ri){
    output += '| ' + row.map(function(cell, i) {return pad(colMaxWidth(table, i), cell, ri === 1 ? '-' : ' ');}).join(' | ') + ' |\n';
  });
  var lineLength = output.split('\n')[0].length - 2; // length of first (header) line minus two chars for edges
  var border = '+' + pad(lineLength, '', '-') + '+';
  print(border + '\n' + output + border);
}

}()); // end strict mode
