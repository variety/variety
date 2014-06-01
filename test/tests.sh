#!/bin/sh

# Need to link globally installed libraries to local directory. Without this, it is not possible to call 'require(lib)'
# in source codes (jasmine tests). This could be replaced by configuring package.json (define dependencies, test script)
npm link mongodb

# current script directory, used as relative path to test resources
DIRNAME=`dirname $0`

# cumulative return code
RETURNCODE=0

# init scripts, create test data used by variety
mongo test < $DIRNAME/init.js

# check, that import finished correctly, otherwise exit (TODO: should we try to cleanup resources?)
if [ $? -ne 0 ]; then
    echo "Failed to initialize tests from file $DIRNAME/init.js"
    exit 1
fi

# run variety itself. Analyze collection users in database test
mongo test --eval "var collection = 'users'" $DIRNAME/../variety.js

# in case of fail do not exit, just log, set return code and continue to cleanup
if [ $? -ne 0 ]; then
    echo "Failed to execute variety"
    RETURNCODE=2
fi

if [ $RETURNCODE -eq 0 ]; then
    echo "Running jasmine tests for variety"
    jasmine-node $DIRNAME/../test --verbose --captureExceptions

    if [ $? -ne 0 ]; then
        echo "There ware test errors, see log above!"
        RETURNCODE=3
    else
        echo "Tests finished, no problem detected"
    fi
else
  echo "tests skipped because of fail when run variety analyzer"
fi

#cleanup resources
mongo test < $DIRNAME/cleanup.js
if [ $? -ne 0 ]; then
    echo "Failed to cleanup test resources"
    RETURNCODE=4
fi

exit $RETURNCODE