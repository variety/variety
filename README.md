# Meet Variety, a Schema Analyzer for MongoDB
This lightweight tool helps you get a sense of your application's schema, as well as any outliers to that schema. Particularly useful when you inherit a codebase with a data dump and want to quickly learn how the data's structured. Also useful for finding rare keys.

***

_“I happen to slowly be falling in love with Variety! It is actually one of the most useful tools to get a sense for a messy/unknown data set, and I have put it in a few of our exercises at Zipfian Academy.”_

Jon Dinu
_Co-founder of [Zipfian Academy](https://www.zipfianacademy.com/)_

***

_“This code saved me at least an hour of work, so least i could do was spend a minute to [say thanks](https://github.com/variety/variety/issues/107#issue-129803853). Thank you.”_

[@a-c-m](https://github.com/a-c-m)

***

Also featured on the [official MongoDB blog](https://web.archive.org/web/20231002225312/http://www.mongodb.com:80/blog/post/meet-variety-a-schema-analyzer-for-mongodb).

## An Easy Example

We'll make a collection:

    db.users.insert({name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someWeirdLegacyKey: "I like Ike!"});
    db.users.insert({name: "Dick", bio: "I swordfight.", birthday: new Date("1974/03/14")});
    db.users.insert({name: "Harry", pets: "egret", birthday: new Date("1984/03/14")});
    db.users.insert({name: "Geneviève", bio: "Ça va?"});
    db.users.insert({name: "Jim", someBinData: new BinData(2,"1234")});

So, let's see what we've got here:

    $ mongosh test --eval "var collection = 'users'" variety.js

    +--------------------------------------------------------------------+
    | key                | types                | occurrences | percents |
    | ------------------ | -------------------- | ----------- | -------- |
    | _id                | ObjectId             |           5 |    100.0 |
    | name               | String               |           5 |    100.0 |
    | bio                | String               |           3 |     60.0 |
    | birthday           | Date                 |           2 |     40.0 |
    | pets               | String (1),Array (1) |           2 |     40.0 |
    | someBinData        | BinData-old          |           1 |     20.0 |
    | someWeirdLegacyKey | String               |           1 |     20.0 |
    +--------------------------------------------------------------------+

_(`test` is the database containing the collection we are analyzing.)_

These examples use `mongosh`. If your environment still ships the legacy `mongo`
shell instead, substitute that executable in the commands below.

Hmm. Looks like everybody has a `name` and `_id`. Most, but not all have a `bio`.

Interestingly, it looks like `pets` can be either an array or a string, but there are more arrays than strings. Will this cause any problems in the application, I wonder?

Seems like the first document created has a weird legacy key—those damn fools who built the prototype didn't clean up after themselves. If there were a thousand such early documents, I might cross-reference the codebase to confirm they are no longer used, and then delete them all. That way they'll not confuse any future developers.

By default, Variety prints results to standard output. If you want to store them in MongoDB for later use, see [Save Results in MongoDB For Future Use](#save-results-in-mongodb-for-future-use).

## See Progress When Analysis Takes a Long Time

Variety does not print its own progress bar or "percent complete" measurement.

For long-running analyses, watch the MongoDB server logs instead. If MongoDB
reports progress for the underlying work, it will appear in `mongod`'s logs,
not in Variety's output.

Where those logs live depends on how MongoDB is running: they may be in a log
file, available through `journalctl`, or exposed by your container runtime.

Some MongoDB versions and logging configurations do not emit a percentage for
these operations. If you do not see one, Variety may still be running normally;
it just means MongoDB is not exposing that measurement in your environment.

## Analyze Only Recent Documents

Perhaps you have a really large collection, and you can't wait a whole day for Variety's results.

Perhaps you want to ignore a collection's oldest documents, and only see what the collection's documents' structures have been looking like, as of late.

One can apply a `limit` constraint, which analyzes only the newest documents in a collection ([unless sorting](#analyze-documents-sorted-in-a-particular-order)), like so:

    $ mongosh test --eval "var collection = 'users', limit = 1" variety.js

Let's examine the results closely:

    +----------------------------------------------------+
    | key         | types       | occurrences | percents |
    | ----------- | ----------- | ----------- | -------- |
    | _id         | ObjectId    |           1 |    100.0 |
    | name        | String      |           1 |    100.0 |
    | someBinData | BinData-old |           1 |    100.0 |
    +----------------------------------------------------+

We are only examining the newest document here (`limit = 1`, using Variety's default `_id: -1` sort). It belongs to Jim, and only contains the `_id`, `name`, and `someBinData` fields. So it makes sense these are the only three keys.

## Analyze Documents to a Maximum Depth

Perhaps you have a potentially very deep nested object structure, and you don't want to see more than a few levels deep in the analysis.

One can apply a `maxDepth` constraint, which limits the depth Variety will recursively search to find new objects.

    db.users.insert({name:"Walter", someNestedObject:{a:{b:{c:{d:{e:1}}}}}});

The default will traverse all the way to the bottom of that structure:

    $ mongosh test --eval "var collection = 'users'" variety.js

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

    $ mongosh test --eval "var collection = 'users', maxDepth = 3" variety.js

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

## Analyze a Subset of Documents

Perhaps you have a large collection, or you only care about some subset of the documents.

One can apply a `query` constraint, which takes a standard MongoDB query object, to filter the set of documents required before analysis.

    $ mongosh test --eval "var collection = 'users', query = {'caredAbout':true}" variety.js

## Analyze Documents Sorted In a Particular Order

Perhaps you want to analyze a subset of documents sorted in an order other than creation order, say, for example, sorted by when documents were updated.

One can apply a `sort` constraint, which analyzes documents in the specified order like so:

    $ mongosh test --eval "var collection = 'users', sort = { updated_at : -1 }" variety.js

## Include Last Value

One can also apply a `lastValue` constraint to capture one representative value for each key.

    $ mongosh test --eval "var collection = 'orders', lastValue = true" variety.js
    
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

Variety captures each `lastValue` from the first matching document it sees in the configured sort order. If you do not provide `sort`, it uses the default `{ _id: -1 }` ordering, so these values come from the newest matching documents encountered during the scan.
`Date` is converted into `timestamp`, `ObjectId` into `string`, and binary data into hex. Other types are shown in square brackets.
Variety reports BSON wrapper types such as `Decimal128`, `Timestamp`, `Code`, `BSONRegExp`, `MinKey`, `MaxKey`, and `DBRef` by their BSON type names in the `types` column.

## Output Formats and Plugins

Variety has a built-in formatter registry and a plugin system, both of which use the same `formatResults` interface. Built-in formatters are selected by name; plugins override the built-in entirely when a `formatResults` hook is provided.

### Built-in Formats

Two formatters are included out of the box:

| Format | Description |
| --- | --- |
| `ascii` (default) | Padded table, as shown throughout this README |
| `json` | Pretty-printed JSON array, suitable for piping to other tools |

Select a format with the `outputFormat` option:

    $ mongosh test --quiet --eval "var collection = 'users', outputFormat='json'" variety.js

Passing an unrecognised value throws an error listing the valid options.

### Plugins

A plugin is a `.js` file that exports a plain object. Variety calls lifecycle hooks on it at specific points during execution:

| Hook | When called | Expected return value |
| --- | --- | --- |
| `init(config)` | Once, after the plugin is loaded | — |
| `onConfig(config)` | Once, after Variety's config is resolved | — |
| `formatResults(results)` | After analysis completes, instead of the built-in formatter | String to print |

Any hook may be omitted. A plugin that only defines `formatResults` is a custom output formatter; one that only defines `onConfig` can act as a post-processing step without changing the output.

**Example: CSV plugin**

```js
// my-csv-plugin.js
module.exports = {
  formatResults(results) {
    const headers = ['key', 'types', 'occurrences', 'percents'];
    const rows = results.map((row) =>
      [row._id.key, Object.keys(row.value.types).join('+'), row.totalOccurrences, row.percentContaining].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  },
};
```

Load it with the `plugins` option (comma-separated for multiple):

    $ mongosh test --quiet --eval "var collection='users', plugins='/path/to/my-csv-plugin.js'" variety.js

Pass per-plugin configuration by appending `|key=value&key=value` after the path:

    $ mongosh test --quiet --eval "var collection='users', plugins='/path/to/my-csv-plugin.js|delimiter=;'" variety.js

The plugin receives the config object in `init` as `{ delimiter: ';' }`. See [CONTRIBUTING.md](CONTRIBUTING.md) for a complete guide to writing and testing plugins.

### Quiet Option

Both MongoDB and Variety output some additional information to standard output. If you want to remove this info, you can use the `--quiet` option provided by the MongoDB shell executable.
Variety can also read that option and mute unnecessary output. This is useful in connection with `outputFormat=json`. You would then receive only JSON, without any other characters around it.

    $ mongosh test --quiet --eval "var collection = 'users', outputFormat='json', sort = { updated_at : -1 }" variety.js

### Log Keys and Types As They Arrive Option
Sometimes you want to see the keys and types come in as it happens.  Maybe you have a large dataset and want accurate results, but you also are impatient and want to see something now.  Or maybe you have a large mangled dataset with crazy keys (that probably shouldn't be keys) and Variety is going out of memory.  This option will show you the keys and types as they come in and help you identify problems with your dataset without needing the Variety script to finish.  

    $ mongosh test --eval "var collection = 'users', sort = { updated_at : -1 }, logKeysContinuously = true" variety.js

### Exclude Subkeys
Sometimes you inherit a database full of junk.  Maybe the previous developer put data in the database keys, which causes Variety to go out of memory when run.  After you've run the `logKeysContinuously` to figure out which subkeys may be a problem, you can use this option to run Variety without those subkeys.  

    db.users.insert({name:"Walter", someNestedObject:{a:{b:{c:{d:{e:1}}}}}, otherNestedObject:{a:{b:{c:{d:{e:1}}}}}});

    $ mongosh test --eval "var collection = 'users', sort = { updated_at : -1 }, excludeSubkeys = [ 'someNestedObject.a.b' ]" variety.js

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

### Show Array Elements

By default, Variety suppresses keys that end with an array index (e.g. `tags.XX`), because the parent key already captures the `Array` type. If you want to see the types of the values _inside_ primitive arrays — useful for verifying element-type consistency — set `showArrayElements` to `true`:

    $ mongosh test --eval "var collection = 'users', showArrayElements = true" variety.js

For example, given documents like:

    db.users.insertMany([
      { name: 'Alice', tags: ['a', 'b'] },
      { name: 'Bob',   tags: ['c', 1]   }
    ]);

Without `showArrayElements`, only the `tags` key (type `Array`) appears. With it enabled, you also see:

    +----------------------------------------------------------+
    | key     | types                 | occurrences | percents |
    | ------- | --------------------- | ----------- | -------- |
    | tags    | Array                 |           2 |    100.0 |
    | tags.XX | String (2),Number (1) |           2 |    100.0 |
    +----------------------------------------------------------+

This reveals that `tags` contains mixed element types across the collection.

### Compact Array Types

If you want the parent array key itself to carry a more informative summary than plain `Array`, set `compactArrayTypes` to `true`:

    $ mongosh test --eval "var collection = 'users', compactArrayTypes = true" variety.js

With this option enabled, parent keys can be reported as values such as `Array(String)`, `Array(Number|String)`, or `Array(empty)` instead of just `Array`.

This option is complementary to `showArrayElements`: `compactArrayTypes` makes the parent key more descriptive, while `showArrayElements` still exposes the `tags.XX`-style child keys when you want per-element detail.

_Thanks to [@oufeng](https://github.com/oufeng) for suggesting this feature ([#166](https://github.com/variety/variety/issues/166))._

### Secondary Reads
Analyzing a large collection on a busy replica set primary could take a lot longer than if you read from a secondary. To do so, we have to tell MongoDB it's okay to perform secondary reads
by setting the `slaveOk` property to `true`:

    $ mongosh secondary.replicaset.member:31337/somedb --eval "var collection = 'users', slaveOk = true" variety.js

## Save Results in MongoDB For Future Use
By default, Variety prints results only to standard output and does not store them in MongoDB itself. If you want to persist them automatically in MongoDB for later usage, you can set the `persistResults` parameter.
Variety then stores result documents in the `varietyResults` database, and the collection name is derived from the source collection's name.
If the source collection's name is `users`, Variety stores results in the `usersKeys` collection under the `varietyResults` database.

    $ mongosh test --quiet --eval "var collection = 'users', persistResults=true" variety.js

To persist to an alternate MongoDB database, you may specify the following parameters:

- `resultsDatabase` - The database to store Variety results in. Accepts either a database name or a `host[:port]/database` URL.
- `resultsCollection` - Collection to store Variety results in. **WARNING:** This collection is dropped before results are inserted.
- `resultsUser` - MongoDB username for results database
- `resultsPass` - MongoDB password for results database

```
$ mongosh test --quiet --eval "var collection = 'users', persistResults=true, resultsDatabase='db.example.com/variety'" variety.js
```

## Reserved Keys
Variety expects keys to be well formed, not having any `.`s in them (MongoDB 2.4 allows dots in certain cases).  Also MongoDB uses the pseudo keys `XX` and keys corresponding to the regex `XX\d+XX.*` for use with arrays.  You can change the string `XX` in these patterns to whatever you like if there is a conflict in your database using the `arrayEscape` parameter.  

    $ mongosh test --quiet --eval "var collection = 'users', arrayEscape = 'YY'" variety.js

## Command Line Interface
This NPM package publishes a built-in `variety` executable that resolves the bundled `variety.js`, prefers `mongosh` when available, and falls back to the legacy `mongo` shell.

The primary interface is:

```bash
variety DB/COLLECTION [options]
```

Examples:

```bash
variety test/users
```

```bash
variety test/users --outputFormat json --quiet
```

```bash
variety logs/webserver --limit 100 --maxDepth 3 --sort '{"created":-1}'
```

```bash
variety test/users --query '{"bio":{"$exists":true}}' --host localhost --port 27017
```

Structured flags such as `--query` and `--sort` accept strict JSON. Connection flags such as `--host`, `--port`, `--username`, `--password`, `--authenticationDatabase`, and `--quiet` are passed through to the Mongo shell. `--eval` remains available as an escape hatch when you need to append raw JavaScript assignments.

When you invoke `variety` with no CLI arguments, the documented compatibility environment variables remain supported:

| Variable | Description |
| --- | --- |
| `DB` | MongoDB database name to pass to the shell |
| `EVAL_CMDS` | JavaScript assignments forwarded via `--eval` (e.g. `var collection = 'users', limit = 100`) |
| `VARIETYJS_DIR` | Directory containing `variety.js`; when omitted, the CLI uses the bundled script |

Examples:

```bash
DB=test EVAL_CMDS="var collection = 'users', outputFormat='json'" variety
```

```bash
DB=test EVAL_CMDS="var collection = 'users', maxDepth = 3, limit = 500" variety
```

Direct `mongosh ... variety.js` usage remains supported and is still useful when you want the most transparent low-level invocation for debugging or advanced shell work.

### Loading Variety From an Interactive Mongo Shell

If you are already inside `mongosh` or the legacy `mongo` shell, define the
same globals you would normally pass with `--eval`, then load `variety.js`:

```js
var collection = "users";
load("/path/to/variety.js");
```

The `load()` call executes Variety immediately; there is no separate function
to call after the script loads. Set any additional options before `load()`:

```js
var collection = "users";
var outputFormat = "json";
var limit = 100;
load("/path/to/variety.js");
```

This low-level form is useful for exploratory shell sessions or debugging. For
regular terminal use, prefer the packaged `variety DB/COLLECTION [options]`
command.

Hat tip: [@abrin](https://github.com/abrin) ([issue #131](https://github.com/variety/variety/issues/131)). Follow-up: [issue #264](https://github.com/variety/variety/issues/264)

Note: `variety-cli`, a formerly available companion project that offered higher-level argument parsing, has been archived and is no longer maintained.

### Calling Variety From Node.js

Variety can be automated from a Node.js application by spawning the packaged
`variety` executable, but it is not an in-process Node.js library API. For
machine-readable output, run the CLI with `--outputFormat json --quiet` and
parse stdout:

```js
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

async function analyzeCollection() {
  const { stdout } = await execFileAsync("variety", [
    "test/users",
    "--outputFormat",
    "json",
    "--quiet",
  ]);

  return JSON.parse(stdout);
}
```

Be careful exposing this pattern from a web endpoint. Keep database credentials
server-side, validate collection names and options, and pass arguments as an
array instead of constructing a shell command from request input. If an endpoint
only needs the available field names, the MongoDB Node.js driver may be a better
fit than shelling out to Variety for each request.

Hat tip: [@ashishtilara](https://github.com/ashishtilara) ([issue #125](https://github.com/variety/variety/issues/125)). Follow-up: [issue #263](https://github.com/variety/variety/issues/263)

## "But my dad told me MongoDB is a schemaless database!"

First of all, your father is a great guy. Moving on…

A MongoDB collection does not enforce a predefined schema like a relational database table. Still, documents in real-world collections nearly always have large sections for which the format of the data is the same. In other words, there is a schema to the majority of collections, it's just enforced by the _application_, rather than by the database system. And this schema is allowed to be a bit fuzzy, in the same way that a given table column might not be required in all rows, but to a much greater degree of flexibility. So we examine what percent of documents in the collection contain a key, and we get a feel for, among other things, how crucial that key is to the proper functioning of the application.

## Dependencies

The packaged `variety` executable runs on Node.js and a MongoDB shell (`mongosh` is preferred; the legacy `mongo` shell still works where available). If you run Variety directly as `mongosh ... variety.js`, the shell path still depends only on MongoDB plus a MongoDB shell.

## Contributing

For setup, repo layout and the `variety.js` build, testing, linting, and how to report issues or send patches, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Core Maintainers

- Tomáš Dvořák ([LinkedIn](https://www.linkedin.com/in/dvoraktomas/))
- Eve Freeman ([Github](https://github.com/freeeve))
- James Cropcho (original creator of Variety) ([Twitter/X](https://x.com/Cropcho))

## Special Thanks

Additional special thanks to Gaëtan Voyer-Perraul ([@gatesvp](https://x.com/gatesvp)) and Kristina Chodorow ([@kchodorow](https://x.com/kchodorow)) for answering other people's questions about how to do this on Stack Overflow, thereby providing me with the initial seed of code which grew into this tool.

Much thanks also, to Kyle Banker ([@Hwaet](https://x.com/hwaet)) for writing an unusually good book on MongoDB, which has taught me everything I know about it so far.

## Tools Which Use Variety (Open Source)

Know of one? Built one? Let us know!

## Stay Safe

I have every reason to believe this tool will **not** corrupt your data or harm your computer. But if I were you, I would not use it in a production environment.

Released by James Cropcho, © 2012–2026, under the [MIT License](https://opensource.org/license/MIT).
