#! /usr/bin/env bash
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
set -e

RUNNER=$(command -v docker 2>/dev/null || command -v podman 2>/dev/null)
if [ -z "$RUNNER" ]; then
  echo "Error: neither docker nor podman found in PATH" >&2
  exit 1
fi
RUNNER_NAME=$(basename "$RUNNER")

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
CACHE_SCOPE=${DOCKER_BUILD_CACHE_SCOPE:-variety-test-mongodb$MONGODB_VERSION-nodejs$NODEJS_VERSION}

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

build_without_cache() {
  echo "Building Docker image for Variety tests without cache…"
  "$RUNNER" build --no-cache --tag "$DOCKERIMAGE" -f "$DOCKERFILES_DIR/$DOCKERFILE" .
}

build_with_github_actions_cache() {
  echo "Building Docker image for Variety tests with GitHub Actions cache scope \"$CACHE_SCOPE\"…"
  "$RUNNER" buildx build \
    --pull \
    --cache-from "type=gha,scope=$CACHE_SCOPE" \
    --cache-to "type=gha,mode=min,scope=$CACHE_SCOPE,ignore-error=true" \
    --load \
    --tag "$DOCKERIMAGE" \
    -f "$DOCKERFILES_DIR/$DOCKERFILE" .
}

github_actions_cache_available() {
  [ "$RUNNER_NAME" = "docker" ] || return 1
  [ "${GITHUB_ACTIONS:-}" = "true" ] || return 1
  [ -n "${ACTIONS_RUNTIME_TOKEN:-}" ] || return 1
  if [ -z "${ACTIONS_CACHE_URL:-}" ] && [ -z "${ACTIONS_RESULTS_URL:-}" ]; then
    return 1
  fi
  "$RUNNER" buildx version >/dev/null 2>&1
}

if [ "${DOCKER_BUILD_CACHE:-}" = "gha" ]; then
  if github_actions_cache_available; then
    if ! build_with_github_actions_cache; then
      echo "GitHub Actions Docker cache build failed; retrying with a clean rebuild."
      build_without_cache
    fi
  else
    echo "GitHub Actions Docker cache requested but unavailable; doing a clean rebuild."
    build_without_cache
  fi
else
  build_without_cache
fi

"$RUNNER" run --rm --tty --volume "$VARIETY_SOURCECODE_PATH:$VARIETY_DOCKERDIR" --name "$CONTAINER" "$DOCKERIMAGE"
