# MongoDB Schema Analyzer #
This tool helps you get a sense of your application's schema, as well as any outliers to that schema. Particularly useful when you inherit a codebase with data dump and want to quickly learn how the data's structured. Also useful for finding rare keys.

### An Easy Example ###

We'll make a collection:

	db.users.insert({name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someWeirdLegacyKey: "I like Ike!"});
	db.users.insert({name: "Dick", bio: "I swordfight."});
	db.users.insert({name: "Harry", pets: "egret"});
	db.users.insert({name: "Geneviève", bio: "Ça va?"});

So, let's see what we've got here:

	$ mongo test --eval "var collection = 'users'" mongoDBSchemaAnalyzer.js
	
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

### See Progress When Analysis Takes a Long Time ###

Tailing the log is great for this. Mongo provides a "percent complete" measurement for you. These operations can take a long time on huge collections.

### Analyze Only Recent Documents ###

Perhaps you have a really large collection, and you can't wait a whole day for the Schema Analyzer's results.

Perhaps you want to ignore a collection's oldest documents, and only see what the collection's documents' structures have been looking like, as of late.

One can apply a "limit" constraint, which analyzes only the newest documents in a collection, like so:

	$ mongo test --eval "var collection = 'users', limit = 500" mongoDBSchemaAnalyzer.js

##### Dependencies #####

Absolutely none, except MongoDB. Written in 100% JavaScript.

#### Special Thanks ####

I offer sincere thanks to Gaëtan Voyer-Perraul ([@gatesvp] (https://twitter.com/#!/@gatesvp)) and Kristina Chodorow ([@kchodorow] (https://twitter.com/#!/kchodorow)) for answering other people's questions about how to do this on Stack Overflow, thereby providing me with the initial seed of code which grew into this tool.

Much thanks also, to Kyle Banker ([@Hwaet] (https://twitter.com/#!/hwaet)) for writing an unusually good book on MongoDB, which has taught me everything I know about it so far.

##### Stay Safe #####

I every reason to believe this tool will **not** corrupt your data or harm your computer. But if I were you, I would not use it in a production environment.


Released by Maypop Inc, © 2012, under the [MIT License] (http://www.opensource.org/licenses/MIT).

