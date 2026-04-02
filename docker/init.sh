#! /usr/bin/env bash

### Init script for test suite's Docker container ###

MONGODB_PORT=27017
NVM_DIR="$HOME/.nvm"
VARIETY_DOCKERDIR=/opt/variety

# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start MongoDB quietly. Newer server releases removed --nojournal.
mongod --logpath /dev/null &

cd "$VARIETY_DOCKERDIR" || exit

# NVM is already sourced; redirect HOME so babel-register doesn't try to write
# its cache to /data/db, which mongod owns and makes non-writable at runtime.
# Keep it out of the mounted repo so mongosh logs do not pollute the worktree.
export HOME=/tmp/variety-home
mkdir -p "$HOME"

npm install || { echo "npm install failed"; exit 1; }

MAX_RETRIES=60
retries=0

while ! curl --silent http://localhost:$MONGODB_PORT > /dev/null 2>&1
do
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "MongoDB did not become ready after $MAX_RETRIES seconds, giving up."
    exit 1
  fi
  echo "Waiting for MongoDB connection…"
  sleep 1
  retries=$((retries + 1))
done
echo "MongoDB ready"

npm run test:mocha
