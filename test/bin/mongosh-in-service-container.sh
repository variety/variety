#! /usr/bin/env bash
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
set -e

CONTAINER=${MONGO_SHELL_CONTAINER:-variety-mongosh-client}
WORKDIR=${MONGO_SHELL_WORKDIR:-$PWD}

if ! command -v docker > /dev/null 2>&1; then
  echo "Error: docker is required to run mongosh from the service-container test client" >&2
  exit 1
fi

exec docker exec --workdir "$WORKDIR" "$CONTAINER" mongosh "$@"
