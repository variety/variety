# Meet Variety, a Schema Analyzer for MongoDB ###
This lightweight tool helps you get a sense of your application's schema, as well as any outliers to that schema. Particularly useful when you inherit a codebase with data dump and want to quickly learn how the data's structured. Also useful for finding rare keys.

### An Easy Example ###

We'll make a collection:

	db.users.insert({name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someWeirdLegacyKey: "I like Ike!"});
	db.users.insert({name: "Dick", bio: "I swordfight.", birthday: new Date("1974-03-14")});
	db.users.insert({name: "Harry", pets: "egret", birthday: new Date("1984-03-14")});
	db.users.insert({name: "Geneviève", bio: "Ça va?"});
	db.users.insert({name: "Jim", someBinData: new BinData(2,"1234")});

So, let's see what we've got here:

	$ mongo test --eval "var collection = 'users'" variety.js
	
        { "_id" : { "key" : "_id" }, "value" : { "types" : [ "objectId" ] }, "totalOccurrences" : 5, "percentContaining" : 100 }
        { "_id" : { "key" : "name" }, "value" : { "types" : [ "string" ] }, "totalOccurrences" : 5, "percentContaining" : 100 }
        { "_id" : { "key" : "bio" }, "value" : { "types" : [ "string" ] }, "totalOccurrences" : 3, "percentContaining" : 60 }
        { "_id" : { "key" : "birthday" }, "value" : { "types" : [ "date" ] }, "totalOccurrences" : 2, "percentContaining" : 40 }
        { "_id" : { "key" : "pets" }, "value" : { "types" : [ "string", "array" ] }, "totalOccurrences" : 2, "percentContaining" : 40 }
        { "_id" : { "key" : "someBinData" }, "value" : { "type" : "binData" }, "totalOccurrences" : 1, "percentContaining" : 20 }
        { "_id" : { "key" : "someWeirdLegacyKey" }, "value" : { "type" : "string" }, "totalOccurrences" : 1, "percentContaining" : 20 }

_("test" is the database containing the collection we are analyzing.)_

Hmm. Looks like everybody has a "name" and "_id". Most, but not all have a "bio".

Interestingly, it looks like "pets" can be either an array or a string. Will this cause any problems in the application, I wonder?

Seems like the first document created has a weird legacy key- those damn fools who built the prototype didn't clean up after themselves. If there were a thousand such early documents, I might cross-reference the codebase to confirm they are no longer used, and then delete them all. That way they'll not confuse any future developers.

Results are stored for future use in a varietyResults database.

### See Progress When Analysis Takes a Long Time ###

Tailing the log is great for this. Mongo provides a "percent complete" measurement for you. These operations can take a long time on huge collections.

### Analyze Only Recent Documents ###

Perhaps you have a really large collection, and you can't wait a whole day for Variety's results.

Perhaps you want to ignore a collection's oldest documents, and only see what the collection's documents' structures have been looking like, as of late.

One can apply a "limit" constraint, which analyzes only the newest documents in a collection, like so:

	$ mongo test --eval "var collection = 'users', limit = 1" variety.js
	
Let's examine the results closely:

	{ "_id" : { "key" : "_id" }, "value" : { "type" : "object" }, "totalOccurrences" : 4, "percentContaining" : 100 }
	{ "_id" : { "key" : "name" }, "value" : { "type" : "string" }, "totalOccurrences" : 4, "percentContaining" : 100 }
	{ "_id" : { "key" : "bio" }, "value" : { "type" : "string" }, "totalOccurrences" : 3, "percentContaining" : 75 }

We are only examining the last document here ("limit = 1"). It belongs to Geneviève, and only contains the _id, name and bio fields. So it makes sense these are the only three keys.

But how can totalOccurrences still reach 4? "limit" specifies how many documents to search for keys. Then, the tool calculates totalOccurrences and percentContaining from _all_ the collection's documents, even those outside the "limit". This tradeoff is meant to give the most bang for our buck, when using "limit" and learning about a collection.

##### "But my dad told me MongoDB is a schemaless database!" #####

First of all, your father is a great guy. Moving on...

A Mongo collection does not enforce a predefined schema like a relational database table. Still, documents in real-world collections nearly always have large sections for which the format of the data is the same. In other words, there is a schema to the majority of collections, it's just enforced by the _application_, rather than by the database system. And this schema is allowed to be a bit fuzzy, in the same way that a given table column might not be required in all rows, but to a much greater degree of flexibility. So we examine what percent of documents in the collection contain a key, and we get a feel for, among other things, how crucial that key is to the proper functioning of the application.

##### Dependencies #####

Absolutely none, except MongoDB. Written in 100% JavaScript. _(mongod's "noscripting" may not be set to true, and 'strict mode' must be disabled.)_

#### Reporting Issues / Contributing ####

Please report any bugs and feature requests on the Github issue tracker. I will read all reports!

I accept pull requests from forks. Very grateful to accept contributions from folks.

#### Special Thanks ####

I offer sincere thanks to Gaëtan Voyer-Perraul ([@gatesvp] (https://twitter.com/#!/@gatesvp)) and Kristina Chodorow ([@kchodorow] (https://twitter.com/#!/kchodorow)) for answering other people's questions about how to do this on Stack Overflow, thereby providing me with the initial seed of code which grew into this tool.

Much thanks also, to Kyle Banker ([@Hwaet] (https://twitter.com/#!/hwaet)) for writing an unusually good book on MongoDB, which has taught me everything I know about it so far.

##### Stay Safe #####

I have every reason to believe this tool will **not** corrupt your data or harm your computer. But if I were you, I would not use it in a production environment.


Released by Maypop Inc, © 2012, under the [MIT License] (http://www.opensource.org/licenses/MIT).
