#!/bin/sh

# Start script for testing container

# start MongoDB with disabled logs and journal
mongod --nojournal --logpath /dev/null &

# switch to linked sources volume
cd /opt/variety

# install all dependencies
npm install

# Wait until the DB is started and responds on selected port
while ! curl --silent http://localhost:27017  > /dev/null 2>&1
do
  echo "waiting for MongoDB connection"
  sleep 1
done

echo "MongoDB ready on port 27017"

# start actual tests
npm test
