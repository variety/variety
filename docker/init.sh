#! /usr/bin/env bash
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>

### Init script for test suite's Docker container ###

NVM_DIR="$HOME/.nvm"
VARIETY_DOCKERDIR=/opt/variety

# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start MongoDB quietly. Newer server releases removed --nojournal.
MONGOD_LOG=/tmp/variety-mongod.log
mongod --logpath "$MONGOD_LOG" &
MONGOD_PID=$!

cd "$VARIETY_DOCKERDIR" || exit

# NVM is already sourced; redirect HOME so npm and mongosh keep their caches
# and shell history out of /data/db, which mongod owns at runtime.
# Keep it out of the mounted repo so shell logs do not pollute the worktree.
# If dependencies must be installed in-container, keep that install hook-free.
export HUSKY=0
export HOME=/tmp/variety-home
mkdir -p "$HOME"

if [ -x node_modules/.bin/mocha ]; then
  echo "Using mounted node_modules"
else
  npm install || { echo "npm install failed"; exit 1; }
fi

mongo_ping() {
  if command -v mongosh > /dev/null 2>&1; then
    mongosh --quiet --eval 'db.adminCommand({ ping: 1 }).ok' > /dev/null 2>&1
  elif command -v mongo > /dev/null 2>&1; then
    mongo --quiet --eval 'db.adminCommand({ ping: 1 }).ok' > /dev/null 2>&1
  else
    echo "Error: neither mongosh nor mongo found in PATH" >&2
    return 1
  fi
}

MAX_RETRIES=60
retries=0

while ! mongo_ping
do
  if ! kill -0 "$MONGOD_PID" > /dev/null 2>&1; then
    echo "MongoDB exited before becoming ready. mongod log follows:"
    cat "$MONGOD_LOG"
    exit 1
  fi
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "MongoDB did not become ready after $MAX_RETRIES seconds, giving up."
    echo "mongod log follows:"
    cat "$MONGOD_LOG"
    exit 1
  fi
  echo "Waiting for MongoDB connection…"
  sleep 1
  retries=$((retries + 1))
done
echo "MongoDB ready"

npm run test:mocha
