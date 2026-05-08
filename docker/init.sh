#! /usr/bin/env bash
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>

### Init script for test suite's Docker container ###

NVM_DIR="$HOME/.nvm"
VARIETY_DOCKERDIR=/opt/variety

# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Print lane identity up front so every failure log is self-describing.
echo "=== variety container environment ==="
mongod --version 2>&1 | head -1 || true
node --version || true
uname -a || true
echo "======================================"

# Enable core dumps so a future mongod segfault leaves an inspectable artifact.
# The dump location is governed by /proc/sys/kernel/core_pattern on the host;
# setting ulimit here ensures the limit is not suppressed at the process level.
ulimit -c unlimited 2>/dev/null || true

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

# EXIT trap: always report mongod's fate and, on failure, dump its log and a
# resource snapshot. Runs before --rm removes the container, so diagnostics
# reach the caller even when no docker cp is possible.
# shellcheck disable=SC2329
cleanup() {
  local rc=$?

  if kill -0 "$MONGOD_PID" 2>/dev/null; then
    # Tests finished while mongod is still alive; shut it down cleanly.
    kill "$MONGOD_PID" 2>/dev/null || true
  else
    # mongod died during the run — decode and report its exit status.
    wait "$MONGOD_PID" 2>/dev/null
    local mongod_exit=$?
    local sig_info=""
    if [ "$mongod_exit" -gt 128 ] 2>/dev/null; then
      local sig=$((mongod_exit - 128))
      # shellcheck disable=SC2046
      sig_info=" ($(kill -l "$sig" 2>/dev/null || echo "signal $sig"))"
    fi
    echo ""
    echo "=== mongod exited with status ${mongod_exit}${sig_info} ==="
  fi

  if [ "$rc" -ne 0 ]; then
    if [ -f "$MONGOD_LOG" ]; then
      echo ""
      echo "=== mongod log ==="
      cat "$MONGOD_LOG"
      echo "=== end mongod log ==="
    fi

    echo ""
    echo "=== resource snapshot at exit ==="
    grep -E "^(MemTotal|MemFree|MemAvailable)" /proc/meminfo 2>/dev/null || true
    ps -eo pid,rss,comm --sort=-rss 2>/dev/null | head -10 || true
    echo "=== end resource snapshot ==="
  fi
}
trap cleanup EXIT

# Watchdog: if mongod exits while tests are running, kill mocha immediately and
# print a clear banner so cascading hook timeouts are attributed to the real
# cause rather than surfacing as unrelated assertion failures.
mongod_watchdog() {
  while kill -0 "$MONGOD_PID" 2>/dev/null; do
    sleep 2
  done
  if kill -0 "$MOCHA_PID" 2>/dev/null; then
    echo ""
    echo "#################################################################"
    echo "# FATAL: mongod exited unexpectedly during the test run.        #"
    echo "# Aborting mocha — hook timeouts below are symptoms, not        #"
    echo "# independent failures. See '=== mongod exited ===' above.      #"
    echo "#################################################################"
    kill "$MOCHA_PID" 2>/dev/null || true
    sleep 5
    kill -9 "$MOCHA_PID" 2>/dev/null || true
  fi
}

npm run test:mocha &
MOCHA_PID=$!
mongod_watchdog &
WATCHDOG_PID=$!

wait "$MOCHA_PID"
MOCHA_EXIT=$?

kill "$WATCHDOG_PID" 2>/dev/null || true
wait "$WATCHDOG_PID" 2>/dev/null || true

exit $MOCHA_EXIT
