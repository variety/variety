# Meet Variety, a Schema Analyzer for MongoDB ###
This lightweight tool helps you get a sense of your application's schema, as well as any outliers to that schema. Particularly useful when you inherit a codebase with a data dump and want to quickly learn how the data's structured. Also useful for finding rare keys.

***

_“I happen to slowly be falling in love with Variety! It is actually one of the most useful tools to get a sense for a messy/unknown data set, and I have put it in a few of our exercises at Zipfian Academy.”_

Jon Dinu
_Co-founder of [Zipfian Academy](https://www.zipfianacademy.com/)_

***

Also featured on the [official MongoDB blog](https://web.archive.org/web/20231002225312/http://www.mongodb.com:80/blog/post/meet-variety-a-schema-analyzer-for-mongodb).

### An Easy Example ###

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

### See Progress When Analysis Takes a Long Time ###

Variety does not print its own progress bar or "percent complete" measurement.

For long-running analyses, watch the MongoDB server logs instead. If MongoDB
reports progress for the underlying work, it will appear in `mongod`'s logs,
not in Variety's output.

Where those logs live depends on how MongoDB is running: they may be in a log
file, available through `journalctl`, or exposed by your container runtime.

Some MongoDB versions and logging configurations do not emit a percentage for
these operations. If you do not see one, Variety may still be running normally;
it just means MongoDB is not exposing that measurement in your environment.

### Analyze Only Recent Documents ###

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

### Analyze Documents to a Maximum Depth ###

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

### Analyze a Subset of Documents ###

Perhaps you have a large collection, or you only care about some subset of the documents.

One can apply a `query` constraint, which takes a standard MongoDB query object, to filter the set of documents required before analysis.

    $ mongosh test --eval "var collection = 'users', query = {'caredAbout':true}" variety.js

### Analyze Documents Sorted In a Particular Order ###

Perhaps you want to analyze a subset of documents sorted in an order other than creation order, say, for example, sorted by when documents were updated.

One can apply a `sort` constraint, which analyzes documents in the specified order like so:

    $ mongosh test --eval "var collection = 'users', sort = { updated_at : -1 }" variety.js

### Include Last Value ###

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

### Render Output As JSON For Easy Ingestion and Parsing ###

Variety supports two built-in output formats:

- ASCII: nicely formatted tables (as in this README)
- JSON: valid JSON results for subsequent processing in other tools (see also [quiet option](#quiet-option))

Default format is `ascii`. You can select the format with the `outputFormat` property provided to Variety. Valid values are `ascii` and `json`. If you load a plugin with a `formatResults` hook, the plugin can emit a custom format instead.

    $ mongosh test --quiet --eval "var collection = 'users', outputFormat='json'" variety.js

#### Quiet Option ####

Both MongoDB and Variety output some additional information to standard output. If you want to remove this info, you can use the `--quiet` option provided by the MongoDB shell executable.
Variety can also read that option and mute unnecessary output. This is useful in connection with `outputFormat=json`. You would then receive only JSON, without any other characters around it.

    $ mongosh test --quiet --eval "var collection = 'users', outputFormat='json', sort = { updated_at : -1 }" variety.js

#### Log Keys and Types As They Arrive Option ####
Sometimes you want to see the keys and types come in as it happens.  Maybe you have a large dataset and want accurate results, but you also are impatient and want to see something now.  Or maybe you have a large mangled dataset with crazy keys (that probably shouldn't be keys) and Variety is going out of memory.  This option will show you the keys and types as they come in and help you identify problems with your dataset without needing the Variety script to finish.  

    $ mongosh test --eval "var collection = 'users', sort = { updated_at : -1 }, logKeysContinuously = true" variety.js

#### Exclude Subkeys ####
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

#### Show Array Elements ####

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

#### Compact Array Types ####

If you want the parent array key itself to carry a more informative summary than plain `Array`, set `compactArrayTypes` to `true`:

    $ mongosh test --eval "var collection = 'users', compactArrayTypes = true" variety.js

With this option enabled, parent keys can be reported as values such as `Array(String)`, `Array(Number|String)`, or `Array(empty)` instead of just `Array`.

This option is complementary to `showArrayElements`: `compactArrayTypes` makes the parent key more descriptive, while `showArrayElements` still exposes the `tags.XX`-style child keys when you want per-element detail.

_Thanks to [@oufeng](https://github.com/oufeng) for suggesting this feature ([#166](https://github.com/variety/variety/issues/166))._

#### Secondary Reads ####
Analyzing a large collection on a busy replica set primary could take a lot longer than if you read from a secondary. To do so, we have to tell MongoDB it's okay to perform secondary reads
by setting the `slaveOk` property to `true`:

    $ mongosh secondary.replicaset.member:31337/somedb --eval "var collection = 'users', slaveOk = true" variety.js

### Save Results in MongoDB For Future Use ###
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

### Reserved Keys ###
Variety expects keys to be well formed, not having any `.`s in them (MongoDB 2.4 allows dots in certain cases).  Also MongoDB uses the pseudo keys `XX` and keys corresponding to the regex `XX\d+XX.*` for use with arrays.  You can change the string `XX` in these patterns to whatever you like if there is a conflict in your database using the `arrayEscape` parameter.  

    $ mongosh test --quiet --eval "var collection = 'users', arrayEscape = 'YY'" variety.js

### Command Line Interface ###
This NPM package ships a small `bin/variety` wrapper (published as the npm package's `variety` executable) that chooses `mongosh` when available and falls back to the legacy `mongo` shell.

The wrapper is controlled by three environment variables:

| Variable | Description |
| --- | --- |
| `DB` | MongoDB database name to pass to the shell |
| `EVAL_CMDS` | JavaScript assignments forwarded via `--eval` (e.g. `var collection = 'users', limit = 100`) |
| `VARIETYJS_DIR` | Directory containing `variety.js`; defaults to `.` |

Examples:

```bash
DB=test EVAL_CMDS="var collection = 'users', outputFormat='json'" VARIETYJS_DIR=. bin/variety
```

```bash
DB=test EVAL_CMDS="var collection = 'users', maxDepth = 3, limit = 500" VARIETYJS_DIR=. bin/variety
```

Note: `variety-cli`, a formerly available companion project that offered higher-level argument
parsing, has been archived and is no longer maintained.

##### "But my dad told me MongoDB is a schemaless database!" #####

First of all, your father is a great guy. Moving on…

A MongoDB collection does not enforce a predefined schema like a relational database table. Still, documents in real-world collections nearly always have large sections for which the format of the data is the same. In other words, there is a schema to the majority of collections, it's just enforced by the _application_, rather than by the database system. And this schema is allowed to be a bit fuzzy, in the same way that a given table column might not be required in all rows, but to a much greater degree of flexibility. So we examine what percent of documents in the collection contain a key, and we get a feel for, among other things, how crucial that key is to the proper functioning of the application.

##### Dependencies #####

At runtime, Variety itself depends only on MongoDB plus a MongoDB shell (`mongosh` is preferred; the legacy `mongo` shell still works where available). Development and testing add local npm dev dependencies.

##### Development, Hacking #####
This project is NPM based and provides standard NPM functionality. As an additional (not required) dependency, [Docker](https://www.docker.com/) or [Podman](https://podman.io/) can be installed to test against different MongoDB versions.

To install all dev dependencies call as usual:
```
npm install
```

`npm test` runs ESLint plus the default Docker-backed integration test lane. If you already have MongoDB listening on `localhost:27017` and want to run only the mocha suite directly, use:

```
npm run test:mocha
```

The test suite under `spec/` runs as native ESM through its own `spec/package.json`, while the repository root intentionally stays CommonJS so the CLI entrypoint and config files keep their current behavior.

If you have Docker or Podman installed and don't want to test against your own MongoDB instance,
you can execute tests against dockerized MongoDB:

```
npm run test:docker
```
The script downloads one of [the official MongoDB images](https://hub.docker.com/_/mongo/) (based on your provided version),
starts the database, executes the test suite against it (inside the container) and stops the DB.

The Docker harness prefers `mongosh` when it is available and falls back to the legacy `mongo` shell for older images.

Dockerized tests default to MongoDB 8.0 on Node.js 22. You can override `MONGODB_VERSION` and `NODEJS_VERSION` when you want to try another supported combination:

```
MONGODB_VERSION=7.0 npm run test:docker
MONGODB_VERSION=8.0 npm run test:docker
MONGODB_VERSION=8.0 NODEJS_VERSION=24 npm run test:docker
```

GitHub Actions runs a MongoDB matrix on Node.js 22: `5.0` (which ships only the legacy `mongo` shell, exercising that code path), `7.0`, and `8.0` (both of which ship only `mongosh`). A single Node.js 24 smoke test also runs against MongoDB 8.0. MongoDB 6.0+ no longer ships the legacy `mongo` shell, so `5.0` is the newest version available for `mongo`-shell coverage.

##### Linting #####

Pre-commit hooks are managed by [Husky](https://typicode.github.io/husky/) and installed automatically on `npm install`. Each commit runs all of the following, and is blocked if any fail:

- `npm run lint` — ESLint (JavaScript)
- `npm run lint:json` — `@prantlf/jsonlint` (JSON files)
- `npm run lint:markdown` — markdownlint (Markdown files)
- `npm run lint:yaml` — js-yaml (YAML files)
- `npm run lint:dockerfile` — hadolint (`docker/Dockerfile.template`)
- `npm run lint:shell` — shellcheck (shell scripts)
- `npm run typecheck` — TypeScript `checkJs`/JSDoc validation for `.eslint.config.js` and Node-side spec code under `spec`

ESLint applies a shared baseline of formatting and safety rules across the repo. That shared baseline now also bans repo-specific legacy patterns such as `Function('return this')`, `indexOf(...)` presence checks, and unguarded `for...in` loops. Node-side JavaScript such as `.eslint.config.js`, the test suite, and `spec/utils` also opts into a stricter modernization set (`const`, template literals, object shorthand, `Object.hasOwn`, and throwing `Error` objects). The `spec` test tree now also uses type-aware `typescript-eslint` rules backed by `.tsconfig.checkjs.json`, while shell-executed fixtures under `spec/assets` stay on the shared baseline. That `checkJs` pass also enables stricter TypeScript flags such as `noImplicitReturns`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, and `exactOptionalPropertyTypes`. Both ESLint and `npm run test:mocha` now rely on native Node parsing for repo code, with `spec/package.json` marking the test tree as ESM while the root package remains CommonJS. `variety.js` itself opts into a subset of those rules (`no-var`, `prefer-const`, `prefer-template`, `object-shorthand`, and `no-throw-literal`) — the rules that are safe for the ES6+ JavaScript supported by the legacy `mongo` shell since MongoDB 4.4. `prefer-object-has-own` is intentionally excluded: `Object.hasOwn()` is not guaranteed in the legacy `mongo` shell, and all `hasOwnProperty.call()` usages have been replaced by `Object.keys()` / `in` anyway.

The container-based checks, `npm run lint:dockerfile` and `npm run lint:shell`, require a container runtime. [Docker](https://www.docker.com/) is used if available, with [Podman](https://podman.io/) as a fallback. At least one must be installed.

#### Reporting Issues / Contributing ####

Please report any bugs and feature requests on the Github issue tracker. I will read all reports!

I accept pull requests from forks. Very grateful to accept contributions from folks.

#### Core Maintainers ####

- Tomáš Dvořák ([LinkedIn](https://www.linkedin.com/in/dvoraktomas/))
- Eve Freeman ([Github](https://github.com/freeeve))
- James Cropcho (original creator of Variety) ([Twitter/X](https://x.com/Cropcho))

#### Special Thanks ####

Additional special thanks to Gaëtan Voyer-Perraul ([@gatesvp](https://x.com/gatesvp)) and Kristina Chodorow ([@kchodorow](https://x.com/kchodorow)) for answering other people's questions about how to do this on Stack Overflow, thereby providing me with the initial seed of code which grew into this tool.

Much thanks also, to Kyle Banker ([@Hwaet](https://x.com/hwaet)) for writing an unusually good book on MongoDB, which has taught me everything I know about it so far.

#### Tools Which Use Variety (Open Source) ####

Know of one? Built one? Let us know!

#### Stay Safe ####

I have every reason to believe this tool will **not** corrupt your data or harm your computer. But if I were you, I would not use it in a production environment.

Released by James Cropcho, © 2012–2026, under the [MIT License](https://opensource.org/license/MIT).
