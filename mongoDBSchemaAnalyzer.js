if (typeof collection == "undefined") {
  throw "You have to supply a 'collection' variable, à la \"--eval 'var limit = 10'\"";
}

if (typeof limit == "undefined") { limit = db[collection].count(); }
print("Using limit of " + limit);

schemaAnalyzerCanHaveChildren = function (v) {
  var isArray = v && 
                typeof v === 'object' && 
                typeof v.length === 'number' && 
                !(v.propertyIsEnumerable('length'));
  var isObject = typeof v === 'object';
  return isArray || isObject;
}
db.system.js.save( { _id : "schemaAnalyzerCanHaveChildren", value : schemaAnalyzerCanHaveChildren } );
	
schemaAnalyzerMapRecursive = function(parentKey, keys) {
  for (var key in keys) {
		var value = keys[key];
		
		key = (parentKey + "." + key).replace(/\.\d+/g,'.XX');

    emit({key : key}, {type: schemaAnalyzerTypeOf(value)});

    if (schemaAnalyzerCanHaveChildren(value)) {
      schemaAnalyzerMapRecursive(key, value);
    }
  }
}
db.system.js.save({_id: "schemaAnalyzerMapRecursive", value: schemaAnalyzerMapRecursive});

schemaAnalyzerTypeOf = function(thing) {

  var nativeType = typeof thing;
  
  if (nativeType === "undefined") { throw "need an argument"; }

  if (nativeType !== "object") {  
    return nativeType;
  }
  else {
    if (thing && thing.constructor === Array) { 
      return "array";
    }
    else if (thing === null) {
      return "null";
    }
    else {
      return "object";
    }
  }
}
db.system.js.save({_id: "schemaAnalyzerTypeOf", value: schemaAnalyzerTypeOf});

map = function() {
	var keys = this;
	
  for (var key in keys) {
		var value = keys[key];
		
		key = key.replace(/\.\d+/g,'.XX');
		
    emit({key : key}, {type: schemaAnalyzerTypeOf(value)});

    if (schemaAnalyzerCanHaveChildren(value)) {
      schemaAnalyzerMapRecursive(key, value);
    }
  }
}

reduce = function(key, values){
  var types = [];
  values.forEach(function(value) {
    if(value.type && types.indexOf(value.type) === -1) {
      types.push(value.type);
    }
  });
  
  return { types: types };
}

var resultsCollectionName = collection + "Keys";

db[collection].mapReduce(map, reduce, {
                                  out: { 
                                    replace : resultsCollectionName, 
                                    db : "schemaAnalyzerResults"},
                                  limit : limit, 
                                  sort : {_id: -1},
                                  scope : { limit : limit }});

var resultsDB = db.getMongo().getDB("schemaAnalyzerResults");

var numDocuments = db[collection].count();

resultsDB[resultsCollectionName].find({}).forEach(function(key) {
  keyName = key["_id"].key;
  
  if(keyName.match(/\.XX$/)) {
    resultsDB[resultsCollectionName].remove({ "_id" : key["_id"]});
    return;
  }

  if(!(keyName.match(/\.XX/) && !keyName.match(/\.XX$/))) {
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

