# MongoDB Schema Analyzer #
It helps you get a sense of your application's schema, as well as any outliers to that schema. Particularly useful when you inherit a codebase with data dump and want to quickly learn how the data's structured. Also useful for finding rare keys.

### An Easy Example ###

We'll make a collection:

	db.users.insert({name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someWeirdLegacyKey: "I like Ike!"});
	db.users.insert({name: "Dick", bio: "I swordfight."});
	db.users.insert({name: "Harry", pets: "egret"});
	db.users.insert({name: "Geneviève", bio: "Ça va?"});

So, let's see what we've got here:

	mongo test --eval "var collection = 'users'" keys.js
	
	{ "_id" : { "key" : "_id" }, "value" : { "types" : [ "object" ] }, "totalOccurrences" : 4, "percentContaining" : 100 }
	{ "_id" : { "key" : "name" }, "value" : { "types" : [ "string" ] }, "totalOccurrences" : 4, "percentContaining" : 100 }
	{ "_id" : { "key" : "bio" }, "value" : { "types" : [ "string" ] }, "totalOccurrences" : 3, "percentContaining" : 75 }
	{ "_id" : { "key" : "pets" }, "value" : { "types" : [ "string", "array" ] }, "totalOccurrences" : 2, "percentContaining" : 50 }
	{ "_id" : { "key" : "someWeirdLegacyKey" }, "value" : { "type" : "string" }, "totalOccurrences" : 1, "percentContaining" : 25 }

_("test" is the database containing the collection we are analyzing.)_

Hmm. Looks like everybody has a "name" and "_id". Most, but not all have a "bio".

Interestingly, it looks like "pets" can be either an array or a string. Will this cause any problems in the application, I wonder?

Seems like the first document created has a weird legacy key- those damn fools who built the protoype didn't clean up after themselves. If there were a thousand such early documents, I might cross-reference the codebase to confirm they are no longer used, and then delete them all. That way they'll not confuse any future developers.

Results are stored for future use in a schemaAnalyzerResults database.

### Analyze Only Recent Documents ###




SPECIAL THANKS

LICENSE
