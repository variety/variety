#!/bin/bash
set -e

# location of this script
DIR=$(readlink -f $(dirname $0))

# Read version info from env property MONGODB_VERSION or use 2.6 as default
VERSION=${MONGODB_VERSION:=2.6}

# Read Variety.js version from package.json
PACKAGE_VERSION=$(node -p -e "require('./package.json').version")

echo
echo "****************************************"
echo "* "
echo "* Variety.js version $PACKAGE_VERSION"
echo "* MongoDB version $VERSION"
echo "* $(docker --version)"
echo "* "
echo "****************************************"
echo

sed -e "s/{MONGODB_VERSION}/$VERSION/g" docker/Dockerfile.template > Dockerfile_$VERSION

echo "Building docker image for Variety tests..."

docker build -t variety-$VERSION -f Dockerfile_$VERSION . 
docker run -t -v $DIR:/opt/variety variety-$VERSION

rm Dockerfile_$VERSION
