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

## Tests lifecycle
 - Initialization, prepare data. Every test has method annotated with `@Before`.
 - Variety analysis, run variety.js against prepared data and verify results. See `Variety.java`, method `runAnalysis()` and methods annotated with `@Test`.
 - Resources cleanup, see method annotated with `@After`.

## Used databases and collections
Tests use two databases, `test` and `varietyResults`. In DB `test`, there will be created collection `users`.
Collection is later analyzed by variety and results stored in DB `varietyResults`, collection `usersKeys`.

Cleanup method should remove both test and analysis data. 

## Contribute
You can extend current test cases or create new JUnit test. All tests under `test/src/test/` are automatically included into run.