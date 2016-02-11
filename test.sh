#!/bin/bash
set -e

# location of this script
DIR=$(readlink -f $(dirname $0))

VERSION=${MONGODB_VERSION:=2.6}

echo
echo "****************************************"
echo "* "
echo "* Testing Variety.js with MongoDB $VERSION"
echo "* $(docker --version)"
echo "* "
echo "****************************************"
echo

sed -e "s/{MONGODB_VERSION}/$VERSION/g" Dockerfile.template > Dockerfile_$VERSION

docker build -t variety-$VERSION -f Dockerfile_$VERSION .
docker run -t -v $DIR:/opt/variety variety-$VERSION

rm Dockerfile_$VERSION