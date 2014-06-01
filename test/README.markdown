## Variety tests
Tests are primary configured for [Travis-CI](https://travis-ci.org/variety/variety) platform. See `.travis.yml` in repository (`install` and `script` section).

It's easy to run tests locally, but you need to prepare your environment little bit. This readme assumes linux machine, mac would probably work too.
On windows you need [cygwin](http://www.cygwin.com) or some way how to run bash scripts.

## Dependencies
[MongoDB](http://www.mongodb.org) installed, of course. Tests are written in [Jasmine](http://jasmine.github.io), Behavior-Driven JavaScript test framework.
In order to run Jasmine from command line, [Node.js](http://nodejs.org) is required.

Integration between Node.js and Jasmine ensures [jasmine-node](https://www.npmjs.org/package/jasmine-node) package.
Tests connect to MongoDB via node.js connector [node-mongodb-native](https://github.com/mongodb/node-mongodb-native).

## Run tests locally
Install node dependencies globally. This step is necessary just for the first run. After that, packages are installed and ready to use.
```
npm install jasmine-node -g
npm install mongodb -g
```

Run `test/tests.sh` from repository base page. It will run whole lifecycle of tests.

Main indicator of tests result is [exit code](http://tldp.org/LDP/abs/html/exit-status.html) of script.
In case of everything went well, return code is `0`. In case of tests fail, exit code is set to nonzero. Exit code is monitored by Travis-CI and informs about tests success or fail.
Tests produce verbose log messages for detecting problems and errors.

## Tests lifecycle
 - Initialization, prepare data, see `test/init.js`
 - Variety analysis, run variety.js against prepared data
 - Jasmine tests, see `test/variety_spec.js`
 - Resources cleanup, see `test/cleanup.js`

## Used databases and collections
Tests use two databases, `test` and `varietyResults`. In DB `test`, there will be created collection `users`.
Collection is later analyzed by variety and results stored in DB `varietyResults`, collection `usersKeys`.

Cleanup script removes `test.users` and `varietyResults.usersKeys` after tests run. It does not remove any database.

## Contribute
You can extend `variety_spec.js` or create new JavaScript file with extension `_spec.js` (for example `max-depth_spec.js`).
All `_spec.js` files are automatically included in tests by jasmine.