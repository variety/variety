#! /usr/bin/env bash
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
set -e

RUNNER=$(command -v docker 2>/dev/null || command -v podman 2>/dev/null)
if [ -z "$RUNNER" ]; then
  echo "Error: neither docker nor podman found in PATH" >&2
  exit 1
fi

# default versions if none in env
MONGODB_VERSION=${MONGODB_VERSION:=8.0}
NODEJS_VERSION=${NODEJS_VERSION:=22}

NVM_VERSION=0.39.2
VARIETY_VERSION=$(node -p -e "require('./package.json').version")

VERSIONS_ID=$VARIETY_VERSION-mongodb$MONGODB_VERSION-nodejs$NODEJS_VERSION
DOCKERIMAGE="variety:$VERSIONS_ID"
VARIETY_DOCKERDIR=/opt/variety

DOCKERFILES_DIR=./docker/Dockerfiles
DOCKERFILE=variety.$VERSIONS_ID.Dockerfile

CONTAINER=${CONTAINER:=variety-test-$VERSIONS_ID}

VARIETY_SOURCECODE_PATH=$(readlink -f "$(dirname "$0")")/../..

echo
echo "****************************************"
echo "* "
echo "* Variety v$VARIETY_VERSION"
echo "* "
echo "* NodeJS  v$NODEJS_VERSION"
echo "* MongoDB v$MONGODB_VERSION"
echo "* "
echo "* $("$RUNNER" --version)"
echo "* "
echo "****************************************"
echo

mkdir -p "$DOCKERFILES_DIR"

sed -e "s/\${MONGODB_VERSION}/$MONGODB_VERSION/g" \
    -e "s/\${NVM_VERSION}/$NVM_VERSION/g"         \
    -e "s/\${NODEJS_VERSION}/$NODEJS_VERSION/g"   \
    docker/Dockerfile.template > "$DOCKERFILES_DIR/$DOCKERFILE"

echo "Building Docker image for Variety tests…"
"$RUNNER" build --no-cache --tag "$DOCKERIMAGE" -f "$DOCKERFILES_DIR/$DOCKERFILE" .

"$RUNNER" run --rm --tty --volume "$VARIETY_SOURCECODE_PATH:$VARIETY_DOCKERDIR" --name "$CONTAINER" "$DOCKERIMAGE"
