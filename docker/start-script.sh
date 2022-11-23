#! /usr/bin/env bash

### start-script for test suite's Docker container ###

MONGODB_PORT=27017
NVM_DIR="$HOME/.nvm"

[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# start MongoDB with disabled logging and disabled journaling
mongod --nojournal --logpath /dev/null &

cd /opt/variety
npm install # install dependencies

while ! curl --silent http://localhost:$MONGODB_PORT > /dev/null 2>&1
do
  echo "Waiting for MongoDB connection…"
  sleep 1
done
echo "MongoDB ready"

npm test
