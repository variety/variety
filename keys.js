if (typeof collection == "undefined") {
  throw "You have to supply a 'collection' variable, a la \"--eval 'var limit = 10'\"";
}
//db.system.js.save( { _id : "getCollection", value : function() { return eval(collection); }} );

if (typeof limit == "undefined") { limit = db[collection].count(); }
print("Using limit of " + limit);

//var alreadyEmitted = new Array(); // global

//schemaAnalyzerKeyIsPresent = function(toBeEmitted, alreadyEmitted) {
//  for(key in alreadyEmitted) {
//    if(key["key"] === toBeEmitted["key"] && key["type"] === toBeEmitted["type"]) {
//      return true;
//    }
//  }
//  return false;
//}
//db.system.js.save( { _id : "schemaAnalyzerKeyIsPresent", value : schemaAnalyzerKeyIsPresent } );

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

		toBeEmitted = {key: key, type: typeof value};

//		if(!schemaAnalyzerKeyIsPresent(toBeEmitted,alreadyEmitted)) {
      emit(toBeEmitted, null);
//      alreadyEmitted.push(toBeEmitted);
//    }

    if (schemaAnalyzerCanHaveChildren(value)) {
      schemaAnalyzerMapRecursive(key, value);
    }
  }
}
db.system.js.save({_id: "schemaAnalyzerMapRecursive", value: schemaAnalyzerMapRecursive});

map = function() {
	var keys = this;
//	var alreadyEmitted = new Array(); // reset global variable
	
  for (var key in keys) {
		var value = keys[key];
		
		key = key.replace(/\.\d+/g,'.XX');
		
		toBeEmitted = {key : key, type : typeof value};
		
//		if(!schemaAnalyzerKeyIsPresent(toBeEmitted,alreadyEmitted)) {
//      emit(toBeEmitted, {occurrences: 1});
      emit(toBeEmitted, null);
//      alreadyEmitted.push(toBeEmitted);
//    }

    if (schemaAnalyzerCanHaveChildren(value)) {
      schemaAnalyzerMapRecursive(key, value);
    }
  }
}

reduce = function(key, values){
//	var occurrences = 0;
//	values.forEach(function(value) {
//		occurrences += value.occurrences;
//	});

//	return {occurrences: occurrences};
	return null;
}

//finalize = function(key, value) {
//	value.percentage = value.occurrences / limit * 100.0;
//	return value;
//}

//finalize = function(key, value) {
//  if(!key["key"].match(/\.XX/)) {
//    value = collectionDB.count({key: {$exists: true}});
//  }
//  return value;
//}

var resultsCollectionName = collection + "Keys";

//resultsDB[resultsCollectionName].ensureIndex({ "_id.key" : 1 , "_id.type" : 1},{unique : true});

db[collection].mapReduce(map, reduce, { //finalize: finalize, 
                                  out: { 
                                    replace : resultsCollectionName, 
                                    db : "schemaAnalyzerResults"},
                                  limit : limit, 
                                  sort : {_id: -1},
                                  scope : { limit : limit }});

var resultsDB = db.getMongo().getDB("schemaAnalyzerResults");

var keys =  resultsDB[resultsCollectionName].find();

keys.forEach(function(key) {
  delete key.value;
  keyName = key["_id"].key; // should be keys??

  var existsQuery = {};
  existsQuery[keyName] = {$exists: true};

  if(!keyName.match(/\.XX/)) {
    key.totalOccurences = db[collection].count(existsQuery);
  }
  else {
    var sizeQuery = {};
    sizeQuery[keyName] = {$size: true};
    keyName.totalOccurences = db[collection].count(existsQuery) - db[collection].count(sizeQuery);
  }

  resultsDB[resultsCollectionName].save(key);
  print(tojson(key, '', true));
});

//> db.users.count({"smartalert.daily": {$exists: true}});
//23
//> db.users.count({"smartalert.daily": {$size: 0}});
//3

