/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any 
outliers to that schema. Particularly useful when you inherit a codebase with 
data dump and want to quickly learn how the data's structured. Also useful for 
finding rare keys.

Please see https://github.com/JamesCropcho/variety for details.

Released by Maypop Inc, © 2012, under the MIT License. */

print("Variety: A MongoDB Schema Analyzer")
print("Version 1.1, released 03 June 2012")

var dbs = new Array();
var emptyDbs = new Array();
db.adminCommand('listDatabases').databases.forEach(function(d){
  if(db.getSisterDB(d.name).getCollectionNames().length > 0) {
    dbs.push(d.name);
  }
  if(db.getSisterDB(d.name).getCollectionNames().length == 0) {
    emptyDbs.push(d.name);
  }
});

if (emptyDbs.indexOf(db.getName()) != -1) {
  throw "The database specified ("+ db +") is empty.\n"+ 
        "Possible database options are: " + dbs.join(", ") + ".";
}

if (dbs.indexOf(db.getName()) == -1) {
  throw "The database specified ("+ db +") does not exist.\n"+ 
        "Possible database options are: " + dbs.join(", ") + ".";
}

var collNames = db.getCollectionNames().join(", ");
if (typeof collection === "undefined") {
  throw "You have to supply a 'collection' variable, à la --eval 'var collection = \"animals\"'.\n"+ 
        "Possible collection options for database specified: " + collNames + ".\n"+
        "Please see https://github.com/JamesCropcho/variety for details.";
} 

if (db[collection].count() == 0) {
  throw "The collection specified (" + collection + ") in the database specified ("+ db +") does not exist or is empty.\n"+ 
        "Possible collection options for database specified: " + collNames + ".";
}

if (typeof limit === "undefined") { var limit = db[collection].count(); }
print("Using limit of " + limit);

if (typeof maxDepth === "undefined") { var maxDepth = 99; }
print("Using maxDepth of " + maxDepth);

varietyCanHaveChildren = function (v) {
  var isArray = v && 
                typeof v === 'object' && 
                typeof v.length === 'number' && 
                !(v.propertyIsEnumerable('length'));
  var isObject = typeof v === 'object';
  var specialObject = v instanceof Date || 
                      v instanceof ObjectId ||
                      v instanceof BinData;
  return !specialObject && (isArray || isObject);
}
db.system.js.save( { _id : "varietyCanHaveChildren", value : varietyCanHaveChildren } );
	
varietyMapRecursive = function(parentKey, keys, level) {
  for (var key in keys) {
		var value = keys[key];
		
		key = (parentKey + "." + key).replace(/\.\d+/g,'.XX');

    emit({key : key}, {type: varietyTypeOf(value)});

    if (level < maxDepth - 1 && varietyCanHaveChildren(value)) {
      varietyMapRecursive(key, value, level + 1);
    }
  }
}
db.system.js.save({_id: "varietyMapRecursive", value: varietyMapRecursive});

varietyTypeOf = function(thing) {
  if (typeof thing === "undefined") { throw "varietyTypeOf() requires an argument"; }

  if (typeof thing !== "object") {  
    // the messiness below capitalizes the first letter, so the output matches
    // the other return values below. -JC
    return (typeof thing)[0].toUpperCase() + (typeof thing).slice(1);
  }
  else {
    if (thing && thing.constructor === Array) { 
      return "Array";
    }
    else if (thing === null) {
      return "null";
    }
    else if (thing instanceof Date) {
      return "Date";
    }
    else if (thing instanceof ObjectId) {
      return "ObjectId";
    }
    else if (thing instanceof BinData) {
      var binDataTypes = {};
      binDataTypes[0x00] = "generic";
      binDataTypes[0x01] = "function";
      binDataTypes[0x02] = "old";
      binDataTypes[0x03] = "UUID";
      binDataTypes[0x05] = "MD5";
      binDataTypes[0x80] = "user";
      return "BinData-" + binDataTypes[thing.subtype()];
    }
    else {
      return "Object";
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

    if (varietyCanHaveChildren(value) && maxDepth > 1) {
      varietyMapRecursive(key, value, 1);
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
                                  scope : { limit : limit, maxDepth:maxDepth }});

var resultsDB = db.getMongo().getDB("varietyResults");

var numDocuments = db[collection].count();

resultsDB[resultsCollectionName].find({}).forEach(function(key) {
  keyName = key["_id"].key;
  
  // We throw away keys which end in an array index, since they are not useful
  // for our analysis. (We still keep the key of their parent array, though.) -JC
  if(keyName.match(/\.XX$/)) {
    resultsDB[resultsCollectionName].remove({ "_id" : key["_id"]});
    return;
  }

  if(keyName.match(/\.XX/)) {
    // exists query checks for embedded values for an array 
    // ie. match {arr:[{x:1}]} with {"arr.x":{$exists:true}}
    // just need to pull out .XX in this case
    keyName = keyName.replace(/.XX/g,"");    
  }
  var existsQuery = {};
  existsQuery[keyName] = {$exists: true};

  key.totalOccurrences = db[collection].count(existsQuery);  
  key.percentContaining = (key.totalOccurrences / numDocuments) * 100;

  resultsDB[resultsCollectionName].save(key);
});

var sortedKeys = resultsDB[resultsCollectionName].find({}).sort({totalOccurrences: -1});

sortedKeys.forEach(function(key) {
  print(tojson(key, '', true));
});

