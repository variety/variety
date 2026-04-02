#! /usr/bin/env bash

### Init script for test suite's Docker container ###

MONGODB_PORT=27017
NVM_DIR="$HOME/.nvm"
VARIETY_DOCKERDIR=/opt/variety

# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start MongoDB with disabled journaling and disabled logging
mongod --nojournal --logpath /dev/null &

cd "$VARIETY_DOCKERDIR" || exit

# NVM is already sourced; redirect HOME so babel-register doesn't try to write
# its cache to /data/db, which mongod owns and makes non-writable at runtime.
export HOME="$VARIETY_DOCKERDIR"

npm install

while ! curl --silent http://localhost:$MONGODB_PORT > /dev/null 2>&1
do
  echo "Waiting for MongoDB connection…"
  sleep 1
done
echo "MongoDB ready"

npm run test:mocha
