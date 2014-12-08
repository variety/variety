/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any 
outliers to that schema. Particularly useful when you inherit a codebase with 
data dump and want to quickly learn how the data's structured. Also useful for 
finding rare keys.

Please see https://github.com/variety/variety for details.

Released by Maypop Inc, © 2012-2014, under the MIT License. */

var log = function(message) {
  if(!__quiet) { // mongo shell param, coming from https://github.com/mongodb/mongo/blob/5fc306543cd3ba2637e5cb0662cc375f36868b28/src/mongo/shell/dbshell.cpp#L624
      print(message);
    }
};

log('Variety: A MongoDB Schema Analyzer');
log('Version 1.4.1, released 14 Oct 2014');

var dbs = [];
var emptyDbs = [];

if (typeof db_name === 'string') {
  db = db.getMongo().getDB( db_name );
}


db.adminCommand('listDatabases').databases.forEach(function(d){
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

if (typeof query === 'undefined') { var query = {}; }
log('Using query of ' + tojson(query));

if (typeof limit === 'undefined') { var limit = db[collection].find(query).count(); }
log('Using limit of ' + limit);

if (typeof maxDepth === 'undefined') { var maxDepth = 99; }
log('Using maxDepth of ' + maxDepth);

if (typeof sort === 'undefined') { var sort = {_id: -1}; }
log('Using sort of ' + tojson(sort));

if (typeof outputFormat === 'undefined') { var outputFormat = 'ascii'; }
log('Using outputFormat of ' + outputFormat);

if (typeof persistResults === 'undefined') { var persistResults = false; }
log('Using persistResults of ' + persistResults);

varietyTypeOf = function(thing) {
  if (typeof thing === 'undefined') { throw 'varietyTypeOf() requires an argument'; }

  if (typeof thing !== 'object') {  
    // the messiness below capitalizes the first letter, so the output matches
    // the other return values below. -JC
    return (typeof thing)[0].toUpperCase() + (typeof thing).slice(1);
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
    }
    else {
      return 'Object';
    }
  }
};

//flattens object keys to 1D. i.e. {'key1':1,{'key2':{'key3':2}}} becomes {'key1':1,'key2.key3':2}
//we assume no '.' characters in the keys, which is an OK assumption for MongoDB
function serializeDoc(doc, maxDepth){
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
			if(!(document.hasOwnProperty(key))) {
				continue;
			}
			var value = document[key];
			//objects are skipped here and recursed into later
			//if(typeof value != 'object') 
			result[parentKey+key] = value;
			//it's an object, recurse...only if we haven't reached max depth
			if(isHash(value) && (maxDepth > 1)) {
				serialize(value, parentKey+key+'.',maxDepth-1);
			}
		}
	}
	serialize(doc, '', maxDepth);
	return result;
}

var interimResults = {}; //hold results here until converted to final format
// main cursor
db[collection].find(query).sort(sort).limit(limit).forEach(function(obj) {
	//printjson(obj)
	flattened = serializeDoc(obj, maxDepth);
	//printjson(flattened)
	for (var key in flattened){
		var value = flattened[key];

		//translate unnamed object key from {_parent_name_}.{_index_} to {_parent_name_}.XX
		key = key.replace(/\.\d+/g,'.XX');

		var valueType = varietyTypeOf(value);
		if(!(key in interimResults)){ //if it's a new key we haven't seen yet
			//for the moment, store 'types' as a dictionary.  An easy way to prevent duplicates
			var newEntry = {'types':{},'totalOccurrences':1};
			newEntry['types'][valueType] = true;
			interimResults[key] = newEntry;
		}
		else{ //we've seen this key before
			interimResults[key]['types'][valueType] = true;
			interimResults[key]['totalOccurrences']++;
		}
	}
});


var varietyResults = [];
//now convert the interimResults into the proper format
for(var key in interimResults){
	var entry = interimResults[key];
	var newEntry = {};
	newEntry['_id'] = {'key':key};
	newEntry['value'] = {'types':Object.keys(entry['types'])};
	newEntry['totalOccurrences'] = entry['totalOccurrences'];
	newEntry['percentContaining'] = entry['totalOccurrences']*100/limit;
	varietyResults.push(newEntry);
}

var numDocuments = db[collection].count();

// We throw away keys which end in an array index, since they are not useful
// for our analysis. (We still keep the key of their parent array, though.) -JC
var filter = function(item) {
  return !item._id.key.match(/\.XX$/);
};

var map = function(item) {
  var keyName = item._id.key;
  if(keyName.match(/\.XX/)) {
    // exists query checks for embedded values for an array
    // ie. match {arr:[{x:1}]} with {'arr.x':{$exists:true}}
    // just need to pull out .XX in this case
    keyName = keyName.replace(/.XX/g,'');
  }
  // we don't need to set it if limit isn't being used. (it's set above.)
  if(limit < numDocuments) {
    var existsQuery = {};
    existsQuery[keyName] = {$exists: true};
    item.totalOccurrences = db[collection].count(existsQuery);
  }
  item.percentContaining = (item.totalOccurrences / numDocuments) * 100.0;
  return item;
};

// sort desc by totalOccurrences or by key asc if occurrences equal
var comparator = function(a, b) {
  var countsDiff = b.totalOccurrences - a.totalOccurrences;
  return countsDiff !== 0 ? countsDiff : a._id.key.localeCompare(b._id.key);
};

log('removing leaf arrays in results collection, and getting percentages');
varietyResults = varietyResults.filter(filter).map(map).sort(comparator);

if(persistResults) {
  var resultsDB = db.getMongo().getDB('varietyResults');
  var resultsCollectionName = collection + 'Keys';

  // replace results collection
  log('creating results collection: '+resultsCollectionName);
  resultsDB[resultsCollectionName].drop();
  resultsDB[resultsCollectionName].insert(varietyResults);
}

if(outputFormat === 'json') {
  printjson(varietyResults); // valid formatted json output, compressed variant is printjsononeline()
} else {  // output nice ascii table with results
  var table = [['key', 'types', 'occurrences', 'percents'], ['', '', '', '']]; // header + delimiter rows
  varietyResults.forEach(function(key) {
    table.push([key._id.key, key.value.types.toString(), key.totalOccurrences.toString(), key.percentContaining.toString()]);
  });

  var colMaxWidth = function(arr, index) {
   return Math.max.apply(null, arr.map(function(row){return row[index].toString().length;}));
  };

  var pad = function(width, string, symbol) { return (width <= string.length) ? string : pad(width, string + symbol, symbol); };

  var output = '';
  table.forEach(function(row, ri){
    output += ('| ' + row.map(function(cell, i) {return pad(colMaxWidth(table, i), cell, ri == 1 ? '-' : ' ');}).join(' | ') + ' |\n');
  });
  var lineLength = output.split('\n')[0].length - 2; // length of first (header) line minus two chars for edges
  var border = '+' + pad(lineLength, '', '-') + '+';
  print(border + '\n' + output + border);
}
