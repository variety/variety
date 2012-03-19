use popplet;

canHaveChildren = function (v) {
  var isArray = ( v && 
                  typeof v === 'object' && 
                  typeof v.length === 'number' && 
                  !(v.propertyIsEnumerable('length')));

  var isObject = typeof v === 'object';
  return isArray || isObject;
}
db.system.js.save( { _id : "canHaveChildren", value : canHaveChildren } );

mapRecursive = function(parentKey, keys){
  for (var key in keys) {
		var value = keys[key];
		
		key = key.replace(/\d+/g,'XX');

    emit({"key": parentKey + "." + key, "typee": typeof value}, {occurrences: 1});

    if (canHaveChildren(value)) {
      mapRecursive(parentKey + "." + key, value);
    }
  }
}
db.system.js.save({_id: "mapRecursive", value: mapRecursive});

map = function() {
	var keys = this;

  for (var key in keys) {
		var value = keys[key];
		
		key = key.replace(/\d+/g,'XX');

    emit({"key": key, "typee": typeof value}, {occurrences: 1});

    if (canHaveChildren(value)) {
      mapRecursive(key, value);
    }
  }
}

reduce = function(key, values){
	var occurrences = 0;
	values.forEach(function(value) {
		occurrences += value.occurrences;
	});

	return {occurrences: occurrences};
}

finalize = function(key, value) {
	value.percentage = value.occurrences / 1000 * 100.0;
	return value;
}

db.usersKeyNames.drop();
db.users.mapReduce(map, reduce, { finalize: finalize, 
                                  out: 'usersKeyNames',
                                  verbose: true, 
                                  limit: 1000, 
                                  sort: {_id: -1}});
db.usersKeyNames.find()


