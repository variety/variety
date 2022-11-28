# Meet Variety, a Schema Analyzer for MongoDB ###
This lightweight tool helps you get a sense of your application's schema, as well as any outliers to that schema. Particularly useful when you inherit a codebase with data dump and want to quickly learn how the data's structured. Also useful for finding rare keys.

***

_“I happen to slowly be falling in love with Variety! It is actually one of the most useful tools to get a sense for a messy/unknown data set, and I have put it in a few of our exercises at Zipfian Academy.”_

Jon Dinu
_Co-founder of [Zipfian Academy](http://www.zipfianacademy.com/)_

***

Also featured on the [official MongoDB blog](http://blog.mongodb.org/post/21923016898/meet-variety-a-schema-analyzer-for-mongodb).

### An Easy Example ###

We'll make a collection:

    db.users.insert({name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someWeirdLegacyKey: "I like Ike!"});
    db.users.insert({name: "Dick", bio: "I swordfight.", birthday: new Date("1974/03/14")});
    db.users.insert({name: "Harry", pets: "egret", birthday: new Date("1984/03/14")});
    db.users.insert({name: "Geneviève", bio: "Ça va?"});
    db.users.insert({name: "Jim", someBinData: new BinData(2,"1234")});

So, let's see what we've got here:

    $ mongo test --eval "var collection = 'users'" variety.js

    +------------------------------------------------------------------+
    | key                | types              | occurrences | percents |
    | ------------------ | ------------       | ----------- | -------- |
    | _id                | ObjectId           |           5 |    100.0 |
    | name               | String             |           5 |    100.0 |
    | bio                | String             |           3 |     60.0 |
    | birthday           | Date               |           2 |     40.0 |
    | pets               | Array(1),String(1) |           2 |     40.0 |
    | someBinData        | BinData-old        |           1 |     20.0 |
    | someWeirdLegacyKey | String             |           1 |     20.0 |
    +------------------------------------------------------------------+

_("test" is the database containing the collection we are analyzing.)_

Hmm. Looks like everybody has a "name" and "_id". Most, but not all have a "bio".

Interestingly, it looks like "pets" can be either an array or a string, but there are more arrays than strings. Will this cause any problems in the application, I wonder?

Seems like the first document created has a weird legacy key—those damn fools who built the prototype didn't clean up after themselves. If there were a thousand such early documents, I might cross-reference the codebase to confirm they are no longer used, and then delete them all. That way they'll not confuse any future developers.

Results are stored for future use in a varietyResults database.

### See Progress When Analysis Takes a Long Time ###

Tailing the log is great for this. Mongo provides a "percent complete" measurement for you. These operations can take a long time on huge collections.

### Analyze Only Recent Documents ###

Perhaps you have a really large collection, and you can't wait a whole day for Variety's results.

Perhaps you want to ignore a collection's oldest documents, and only see what the collection's documents' structures have been looking like, as of late.

One can apply a "limit" constraint, which analyzes only the newest documents in a collection ([unless sorting](https://github.com/variety/variety#analyze-documents-sorted-in-a-particular-order)), like so:

	$ mongo test --eval "var collection = 'users', limit = 1" variety.js

Let's examine the results closely:

    +----------------------------------------------------+
    | key         | types       | occurrences | percents |
    | ----------- | ----------- | ----------- | -------- |
    | _id         | ObjectId    |           1 |    100.0 |
    | name        | String      |           1 |    100.0 |
    | someBinData | BinData-old |           1 |    100.0 |
    +----------------------------------------------------+

We are only examining the last document here ("limit = 1"). It belongs to Geneviève, and only contains the _id, name and bio fields. So it makes sense these are the only three keys.

### Analyze Documents to a Maximum Depth

Perhaps you have a potentially very deep nested object structure, and you don't want to see more than a few levels deep in the analysis.

One can apply a "maxDepth" constraint, which limits the depth Variety will recursively search to find new objects.

    db.users.insert({name:"Walter", someNestedObject:{a:{b:{c:{d:{e:1}}}}}});

The default will traverse all the way to the bottom of that structure:

    $ mongo test --eval "var collection = 'users'" variety.js

    +----------------------------------------------------------------+
    | key                        | types    | occurrences | percents |
    | -------------------------- | -------- | ----------- | -------- |
    | _id                        | ObjectId |           1 |    100.0 |
    | name                       | String   |           1 |    100.0 |
    | someNestedObject           | Object   |           1 |    100.0 |
    | someNestedObject.a         | Object   |           1 |    100.0 |
    | someNestedObject.a.b       | Object   |           1 |    100.0 |
    | someNestedObject.a.b.c     | Object   |           1 |    100.0 |
    | someNestedObject.a.b.c.d   | Object   |           1 |    100.0 |
    | someNestedObject.a.b.c.d.e | Number   |           1 |    100.0 |
    +----------------------------------------------------------------+

    $ mongo test --eval "var collection = 'users', maxDepth = 3" variety.js

    +----------------------------------------------------------+
    | key                  | types    | occurrences | percents |
    | -------------------- | -------- | ----------- | -------- |
    | _id                  | ObjectId |           1 |    100.0 |
    | name                 | String   |           1 |    100.0 |
    | someNestedObject     | Object   |           1 |    100.0 |
    | someNestedObject.a   | Object   |           1 |    100.0 |
    | someNestedObject.a.b | Object   |           1 |    100.0 |
    +----------------------------------------------------------+

As you can see, Variety only traversed three levels deep.

### Analyze a Subset of Documents ###

Perhaps you have a large collection, or you only care about some subset of the documents.

One can apply a "query" constraint, which takes a standard Mongo query object, to filter the set of documents required before analysis.

    $ mongo test --eval "var collection = 'users', query = {'caredAbout':true}" variety.js

### Analyze Documents Sorted In a Particular Order ###

Perhaps you want to analyze a subset of documents sorted in an order other than creation order, say, for example, sorted by when documents were updated.

One can apply a "sort" constraint, which analyzes documents in the specified order like so:

    $ mongo test --eval "var collection = 'users', sort = { updated_at : -1 }" variety.js

### Include Last Value ###

You can add ```lastValue``` property to show values of the last document.

    $ mongo test --eval "var collection = 'orders', lastValue = true" variety.js
    
    +--------------------------------------------------------------------------------------------+
    | key             | types        | occurrences | percents | lastValue                        |
    | --------------- | ------------ | ----------- | -------- | -------------------------------- |
    | _id             | ObjectId     |           1 |    100.0 | 5a834b76f4d3fa6e578a67f6         |
    | age             | Number       |           1 |    100.0 |                          38.2569 |
    | animals         | Array        |           1 |    100.0 | [Array]                          |
    | animals.XX.type | String       |           1 |    100.0 | dog                              |
    | balance         | NumberLong   |           1 |    100.0 |                 1236458945684846 |
    | date            | Date         |           1 |    100.0 |                    1513539969000 |
    | fn              | Object       |           1 |    100.0 | [Object]                         |
    | fn.code         | String       |           1 |    100.0 | function (x, y){ return x + y; } |
    | name            | String       |           1 |    100.0 | John                             |
    | nil             | null         |           1 |    100.0 | [null]                           |
    | uid             | BinData-UUID |           1 |    100.0 | 3b241101e2bb42558caf4136c566a962 |
    +--------------------------------------------------------------------------------------------+

If use without ```sort``` it will fetch values of the last natural sorted document.
Date is converted into timestamp, ObjectId into string and binary data as hex. Other types shown in square brackets.

### Render Output As JSON For Easy Ingestion and Parsing ###

Variety supports two different output formats:

- ASCII: nicely formatted tables (as in this README)
- JSON: valid JSON results for subsequent processing in other tools (see also [quiet option](#quiet-option))

Default format is ```ascii```. You can select the type of format with property ```outputFormat``` provided to Variety. Valid values are ```ascii``` and ```json```.

    $ mongo test --quiet --eval "var collection = 'users', outputFormat='json'" variety.js

#### Quiet Option ####
Both MongoDB and Variety output some additional information to standard output. If you want to remove this info, you can use ```--quiet``` option provided to ```mongo``` executable.
Variety can also read that option and mute unnecessary output. This is useful in connection with ```outputFormat=json```. You would then receive only JSON, without any other characters around it.

    $ mongo test --quiet --eval "var collection = 'users', sort = { updated_at : -1 }" variety.js

#### Log Keys and Types As They Arrive Option ####
Sometimes you want to see the keys and types come in as it happens.  Maybe you have a large dataset and want accurate results, but you also are impatient and want to see something now.  Or maybe you have a large mangled dataset with crazy keys (that probably shouldn't be keys) and Variety is going out of memory.  This option will show you the keys and types as they come in and help you identify problems with your dataset without needing the Variety script to finish.  

    $ mongo test --eval "var collection = 'users', sort = { updated_at : -1 }, logKeysContinuously = true" variety.js

#### Exclude Subkeys ####
Sometimes you inherit a database full of junk.  Maybe the previous developer put data in the database keys, which causes Variety to go out of memory when run.  After you've run the `logKeysContinuously` to figure out which subkeys may be a problem, you can use this option to run Variety without those subkeys.  

    db.users.insert({name:"Walter", someNestedObject:{a:{b:{c:{d:{e:1}}}}}, otherNestedObject:{a:{b:{c:{d:{e:1}}}}}});

    $ mongo test --eval "var collection = 'users', sort = { updated_at : -1 }, excludeSubkeys = [ 'someNestedObject.a.b' ]" variety.js

    +-----------------------------------------------------------------+
    | key                         | types    | occurrences | percents |
    | --------------------------- | -------- | ----------- | -------- |
    | _id                         | ObjectId |           1 |    100.0 |
    | name                        | String   |           1 |    100.0 |
    | someNestedObject            | Object   |           1 |    100.0 |
    | someNestedObject.a          | Object   |           1 |    100.0 |
    | someNestedObject.a.b        | Object   |           1 |    100.0 |
    | otherNestedObject           | Object   |           1 |    100.0 |
    | otherNestedObject.a         | Object   |           1 |    100.0 |
    | otherNestedObject.a.b       | Object   |           1 |    100.0 |
    | otherNestedObject.a.b.c     | Object   |           1 |    100.0 |
    | otherNestedObject.a.b.c.d   | Object   |           1 |    100.0 |
    | otherNestedObject.a.b.c.d.e | Number   |           1 |    100.0 |
    +-----------------------------------------------------------------+

#### Secondary Reads ####
Analyzing a large collection on a busy replica set primary could take a lot longer than if you read from a secondary. To do so, we have to tell MongoDB it's okay to perform secondary reads
by setting the ```slaveOk``` property to ```true```:

    $ mongo secondary.replicaset.member:31337/somedb --eval "var collection = 'users', slaveOk = true" variety.js

### Save Results in MongoDB For Future Use ###
By default, Variety prints results only to standard output and does not store them in MongoDB itself. If you want to persist them automatically in MongoDB for later usage, you can set the parameter ```persistResults```.
Variety then stores result documents in database ```varietyResults``` and the collection name is derived from the source collection's name.
If the source collection's name is ```users```, Variety will store results in collection ```usersKeys``` under ```varietyResults``` database.

    $ mongo test --quiet --eval "var collection = 'users', persistResults=true" variety.js

To persist to an alternate MongoDB database, you may specify the following parameters:

  * `resultsDatabase` - The database to store Variety results in. Accepts either a database name or a `host[:port]/database` URL.
  * `resultsCollection` - Collection to store Variety results in. **WARNING:** This collection is dropped before results are inserted.
  * `resultsUser` - MongoDB username for results database
  * `resultsPass` - MongoDB password for results database

```
$ mongo test --quiet --eval "var collection = 'users', persistResults=true, resultsDatabase='db.example.com/variety' variety.js
```

### Reserved Keys ###
Variety expects keys to be well formed, not having any '.'s in them (mongo 2.4 allows dots in certain cases).  Also mongo uses the pseudo keys 'XX' and keys coresponding to the regex 'XX\d+XX.*' for use with arrays.  You can change the string XX in these patterns to whatever you like if there is a conflict in your database using the `arrayEscape` parameter.  

    $ mongo test --quiet --eval "var collection = 'users', arrayEscape = 'YY'" variety.js

### Command Line Interface
Variety itself is command line friendly, as shown on examples above.
But if you are a NPM and Node.js user, you could prefer the
[variety-cli](https://github.com/variety/variety-cli) project. It simplifies usage of
Variety and removes all the complexity of passing variables in the ```--eval``` argument and
providing a path to the variety.js library.

Example of a simplified command-line usage:
```
variety test/users --outputFormat='json' --quiet
```
For more details see the [documentation of variety-cli project](https://github.com/variety/variety-cli).

##### "But my dad told me MongoDB is a schemaless database!" #####

First of all, your father is a great guy. Moving on...

A Mongo collection does not enforce a predefined schema like a relational database table. Still, documents in real-world collections nearly always have large sections for which the format of the data is the same. In other words, there is a schema to the majority of collections, it's just enforced by the _application_, rather than by the database system. And this schema is allowed to be a bit fuzzy, in the same way that a given table column might not be required in all rows, but to a much greater degree of flexibility. So we examine what percent of documents in the collection contain a key, and we get a feel for, among other things, how crucial that key is to the proper functioning of the application.

##### Dependencies #####

Absolutely none, except MongoDB. Written in 100% JavaScript. _(mongod's "noscripting" may not be set to true, and 'strict mode' must be disabled.)_

##### Development, Hacking #####
This project is NPM based and provides standard NPM functionality. As an additional (not required) dependency, [Docker](https://www.docker.com/) can be installed to test against different MongoDB versions.

To install all dev dependencies call as usual:
```
npm install
```

By default, tests expect MongoDB available on ```localhost:27017``` and can be executed by calling:

```
npm test
```

If you have Docker installed and don't want to test against your own MongoDB instance,
you can execute tests against dockerized MongoDB:

```
MONGODB_VERSION=3.2 npm run test:docker
```
The script downloads one of [official MongoDB images](https://hub.docker.com/_/mongo/) (based on your provided version),
starts the database, executes test suite against it (inside the container) and stops the DB.

#### Reporting Issues / Contributing ####

Please report any bugs and feature requests on the Github issue tracker. I will read all reports!

I accept pull requests from forks. Very grateful to accept contributions from folks.

#### Core Maintainers ####

* Tomáš Dvořák ([personal website](http://www.tomas-dvorak.cz/))
* Eve Freeman ([Twitter](https://twitter.com/wefreema))
* James Cropcho (original creator of Variety) ([Twitter](https://twitter.com/Cropcho))

#### Special Thanks ####

Additional special thanks to Gaëtan Voyer-Perraul ([@gatesvp](https://twitter.com/#!/@gatesvp)) and Kristina Chodorow ([@kchodorow](https://twitter.com/#!/kchodorow)) for answering other people's questions about how to do this on Stack Overflow, thereby providing me with the initial seed of code which grew into this tool.

Much thanks also, to Kyle Banker ([@Hwaet](https://twitter.com/#!/hwaet)) for writing an unusually good book on MongoDB, which has taught me everything I know about it so far.

#### Tools Which Use Variety (Open Source) ####

Know of one? Built one? Let us know!

##### Stay Safe #####

I have every reason to believe this tool will **not** corrupt your data or harm your computer. But if I were you, I would not use it in a production environment.


Released by Maypop Inc, © 2012–2023, under the [MIT License] (http://www.opensource.org/licenses/MIT).
