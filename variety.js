/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any 
outliers to that schema. Particularly useful when you inherit a codebase with 
data dump and want to quickly learn how the data's structured. Also useful for 
finding rare keys.

Please see https://github.com/variety/variety for details.

Released by Maypop Inc, © 2012, under the MIT License. */

print("Variety: A MongoDB Schema Analyzer")
print("Version 1.2.2, released 04 November 2012")

var dbs = new Array();
var emptyDbs = new Array();

if (typeof db_name === "string") {
  db = db.getMongo().getDB( db_name );
}


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

if (typeof query === "undefined") { var query = {}; }
print("Using query of " + query.toSource());

if (typeof limit === "undefined") { var limit = db[collection].find(query).count(); }
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

var addTypeToArray = function(arr, value) {
  var t = varietyTypeOf(value);
  var found = false;
  for(var i=0; i< arr.length; i++) {
    if(arr[i] == t) {
      found = true;
      break;
    }
  }
  if(!found) {
    arr.push(t);
  }
}

var addRecordResult = function(key, value, result) {
  cur = result[key];
  if(cur == null) {
    result[key] = {"_id":{"key":key},"value": {"type": varietyTypeOf(value)}, totalOccurrences:1};
  } else {
    var type = varietyTypeOf(value);
    if(cur.value.type != type) {
      cur.value.types = [cur.value.type];
      delete cur.value["type"];
      addTypeToArray(cur.value.types, type);
    } else if(!cur.value.type) {
      addTypeToArray(cur.value.types, type);
    }
    result[key] = cur;
  }
}

var mapRecursive = function(parentKey, obj, level, result) {
  for (var key in obj) {
    if(obj.hasOwnProperty(key)) {
      var value = obj[key];
      key = (parentKey + "." + key).replace(/\.\d+/g,'.XX');
      addRecordResult(key, value, result);
      if (level < maxDepth - 1 && varietyCanHaveChildren(value)) {
        mapRecursive(key, value, level + 1, result);
      }
    }
  }
}

// store results here (no map reduce limit!)
var varietyResults = {};

var addVarietyResults = function(result) {
  for(var key in result) {
    if(result.hasOwnProperty(key)) {
      cur = varietyResults[key];
      var value = result[key];
      if(cur == null) {
        varietyResults[key] = value;
      } else {
        if(value.type && value.type == cur.value.type) {
          
        } else {
          for(type in value.types) {
            if(cur.value.type != type) {
              cur.value.types = [cur.value.type];
              delete cur.value["type"];
              addTypeToArray(cur.value.types, type);
            } else if(!cur.value.type) {
              addTypeToArray(cur.value.types, type);
            }
          }
        }
        cur.totalOccurrences++;
        varietyResults[key] = cur;
      }
    }
  }
}

// main cursor
db[collection].find(query).sort({_id: -1}).limit(limit).forEach(function(obj) {
  var recordResult = {};
  for (var key in obj) {
    if(obj.hasOwnProperty(key)) {
      var value = obj[key];
      addRecordResult(key, value, recordResult);
      if (maxDepth > 1 && varietyCanHaveChildren(value)) {
        mapRecursive(key, value, 1, recordResult);
      }
    }
  }
  addVarietyResults(recordResult);
});

var resultsDB = db.getMongo().getDB("varietyResults");
var resultsCollectionName = collection + "Keys";

// replace results collection
print("creating results collection: "+resultsCollectionName);
resultsDB[resultsCollectionName].drop();
for(result in varietyResults) {
  resultsDB[resultsCollectionName].insert(varietyResults[result]); 
}

var numDocuments = db[collection].count();

print("removing leaf arrays in results collection, and getting percentages");
resultsDB[resultsCollectionName].find({}).forEach(function(key) {
  var keyName = key["_id"].key;
  
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
  // we don't need to set it if limit isn't being used. (it's set above.)
  if(limit < numDocuments) {
    var existsQuery = {};
    existsQuery[keyName] = {$exists: true};
    key.totalOccurrences = db[collection].find(query).count(existsQuery);
  }  
  key.percentContaining = (key.totalOccurrences / numDocuments) * 100.0;
  resultsDB[resultsCollectionName].save(key);
});

var sortedKeys = resultsDB[resultsCollectionName].find({}).sort({totalOccurrences: -1});
sortedKeys.forEach(function(key) {
  print(tojson(key, '', true));
});
