/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any 
outliers to that schema. Particularly useful when you inherit a codebase with 
data dump and want to quickly learn how the data's structured. Also useful for 
finding rare keys.

Please see https://github.com/JamesCropcho/variety for details.

Released by Maypop Inc, © 2012, under the MIT License. */

print("Variety: A MongoDB Schema Analyzer")
print("Version 1.0, released 10 April 2012")

if (typeof collection === "undefined") {
  throw "You have to supply a 'collection' variable, à la --eval 'var collection = \"animals\"'. Please see https://github.com/JamesCropcho/variety for details.";
}

if (typeof limit === "undefined") { var limit = db[collection].count(); }
print("Using limit of " + limit);

varietyCanHaveChildren = function (v) {
  var isArray = v && 
                typeof v === 'object' && 
                typeof v.length === 'number' && 
                !(v.propertyIsEnumerable('length'));
  var isObject = typeof v === 'object';
  return isArray || isObject;
}
db.system.js.save( { _id : "varietyCanHaveChildren", value : varietyCanHaveChildren } );
	
varietyMapRecursive = function(parentKey, keys) {
  for (var key in keys) {
		var value = keys[key];
		
		key = (parentKey + "." + key).replace(/\.\d+/g,'.XX');

    emit({key : key}, {type: varietyTypeOf(value)});

    if (varietyCanHaveChildren(value)) {
      varietyMapRecursive(key, value);
    }
  }
}
db.system.js.save({_id: "varietyMapRecursive", value: varietyMapRecursive});

varietyTypeOf = function(thing) {
  if (typeof thing === "undefined") { throw "varietyTypeOf() requires an argument"; }

  if (typeof thing !== "object") {  
    return typeof thing;
  }
  else {
    if (thing && thing.constructor === Array) { 
      return "array";
    }
    else if (thing === null) {
      return "null";
    }
    else if (thing instanceof Date) {
      return "date";
    }
    else if (thing instanceof ObjectId) {
      return "objectId";
    }
    else {
      return "object";
    }
  }
}
db.system.js.save({_id: "varietyTypeOf", value: varietyTypeOf});

map = function() {
	var keys = this;
	
  for (var key in keys) {
		var value = keys[key];
		
		// Internally, Mongo uses keys like groceries.0, groceries.1, groceries.2 for
		// items in an array. -JC
		key = key.replace(/\.\d+/g,'.XX');
		
    emit({key : key}, {type: varietyTypeOf(value)});

    if (varietyCanHaveChildren(value)) {
      varietyMapRecursive(key, value);
    }
  }
}

reduce = function(key, values){
  var types = [];
  values.forEach(function(value) {
    if(types.indexOf(value.type) === -1) {
      // i.e. "if 'types' does not already have 'value.type', then insert it 
      // into 'types'." -JC
      types.push(value.type);
    }
  });
  
  return { types: types };
}

var resultsCollectionName = collection + "Keys";

db[collection].mapReduce(map, reduce, {
                                  out: { 
                                    replace : resultsCollectionName, 
                                    db : "varietyResults"},
                                  limit : limit, 
                                  sort : {_id: -1},
                                  scope : { limit : limit }});

var resultsDB = db.getMongo().getDB("varietyResults");

var numDocuments = db[collection].count();

// Using our method of retrieving keys, Mongo gets confused about the following, and 
// incorrectly thinks they are keys. -JC
var blackListKeys = ["_id.equals", "_id.getTimestamp", "_id.isObjectId", "_id.str","_id.tojson"];

resultsDB[resultsCollectionName].find({}).forEach(function(key) {
  keyName = key["_id"].key;
  
  // We throw away keys which end in an array index, since they are not useful
  // for our analysis. (We still keep the key of their parent array, though.) -JC
  if(keyName.match(/\.XX$/)) {
    resultsDB[resultsCollectionName].remove({ "_id" : key["_id"]});
    return;
  }

  var blackListKeyFound = false;  

  blackListKeys.forEach(function(blackListKey) {
    if(keyName === blackListKey) {
      resultsDB[resultsCollectionName].remove({ "_id" : { key: keyName }});
      blackListKeyFound = true;
    }
  });

  if(blackListKeyFound) { return; }
  
  if(!(keyName.match(/\.XX/) && !keyName.match(/\.XX$/))) {
    // i.e. "Unless the key's value is an array which contains arrays"  -JC
    // ...we do not support totalOccurrences for these keys because it is
    // a bit too tricky for a 'version 1'. Perhaps we'll support in the future. -JC
    var existsQuery = {};
    existsQuery[keyName] = {$exists: true};

    key.totalOccurrences = db[collection].count(existsQuery);  
    key.percentContaining = (key.totalOccurrences / numDocuments) * 100;
  }

  resultsDB[resultsCollectionName].save(key);
});

var sortedKeys = resultsDB[resultsCollectionName].find({}).sort({totalOccurrences: -1});

sortedKeys.forEach(function(key) {
  print(tojson(key, '', true));
});

