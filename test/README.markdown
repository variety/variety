## Variety tests
Tests are primary configured for [Travis-CI](https://travis-ci.org/variety/variety) platform. See `.travis.yml` in repository (`script` section).

## Dependencies
[MongoDB](http://www.mongodb.org) installed, of course. Tests are written in [JUnit](http://junit.org/), using [Java 8](http://http://docs.oracle.com/javase/8/). [Maven 3](https://maven.apache.org/) is required.
You should have Java 8 and Maven installed. Junit and other dependencies are then automatically handled by Maven (see `test/pom.xml`).

## Run tests locally

Assuming running MongoDB, go to directory `variety/test` (you should see `pom.xml` there) and run `mvn test`.

Main indicator of tests result is [exit code](http://tldp.org/LDP/abs/html/exit-status.html) of script.
In case of everything went well, return code is `0`. In case of tests fail, exit code is set to nonzero. Exit code is monitored by Travis-CI and informs about tests success or fail.
Tests produce verbose log messages for detecting problems and errors.

## Java wrapper
The bridge between JUnit tests and Variety written in pure JS is [Java wrapper for variety](https://github.com/variety/variety/blob/master/test/src/main/java/com/github/variety/Variety.java).
Currently the wrapper is optimized for tests usage and allows:

- Specify analyzed DB and collection name
- Forward all config parameters to Variety.js
- execute mongo shell with all the config values and path to Variety
- Collect standard output of mongo shell
- Verify results values (assertion)
- Access mongo database through native java driver (initialization, cleanup)

Wrapper can be created with this command:

```
Variety wrapper = new Variety("test", "users");
```

where the first parameter is analyzed database name and second analyzed collection name. Wrapper is written following
[builder pattern](https://en.wikipedia.org/wiki/Builder_pattern):

```
ResultsValidator analysis = new Variety("test", "users")
                .withMaxDepth(10)
                .withSort("{name:-1}")
                .withLimit(5)
                .runDatabaseAnalysis();
```

```ResultsValidator``` is the actual analysis result. Main purpose is to easy verify results:

```
validate(String key, double totalOccurrences, double percentContaining, String... types)
```
If the result does not match expectations, AssertionError is thrown (standard JUnit behavior). There are two possibilities,
how to obtain results. Variety can store results in collection in MongoDB, or output results as a valid JSON to standard
output. This two ways have own representations in wrapper:

- runDatabaseAnalysis
- runJsonAnalysis

Both of them preset important options for Variety (quiet, persistResults, outputFormat) to comply with validator.


## Tests lifecycle
 - Initialization, prepare data. Every test has method annotated with `@Before`.
 - Variety analysis, run variety.js against prepared data and verify results. See `Variety.java`, method `runDatabaseAnalysis()` and methods annotated with `@Test`.
 - Resources cleanup, see method annotated with `@After`.

## Used databases and collections
Tests use two databases, `test` and `varietyResults`. In DB `test`, there will be created collection `users`.
Collection is later analyzed by variety and results stored in DB `varietyResults`, collection `usersKeys`.

Cleanup method should remove both test and analysis data. In case of JSON validator, there is no results db/collection created.

## Contribute
You can extend current test cases or create new JUnit test. All tests under `test/src/test/` are automatically included into run.