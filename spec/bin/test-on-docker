#!/bin/bash
set -e

# default versions if none in env
CONTAINER=${CONTAINER:=variety-test}
MONGODB_VERSION=${MONGODB_VERSION:=3.4}
NODEJS_VERSION=${NODEJS_VERSION:=14.21}

NVM_VERSION=0.39.2
VARIETY_VERSION=$(node -p -e "require('./package.json').version")

DOCKERFILE=variety.$MONGODB_VERSION.Dockerfile
DOCKERIMAGE=variety:$VARIETY_VERSION-mongodb$MONGODB_VERSION-nodejs$NODEJS_VERSION

VARIETY_SOURCECODE_PATH=$(readlink -f $(dirname $0))

echo
echo "****************************************"
echo "* "
echo "* Variety v$VARIETY_VERSION"
echo "* MongoDB v$MONGODB_VERSION"
echo "* "
echo "* $(docker --version)"
echo "* "
echo "****************************************"
echo

sed -e "s/{MONGODB_VERSION}/$MONGODB_VERSION/g" \
    -e "s/{NVM_VERSION}/$NVM_VERSION/g"         \
    -e "s/{NODEJS_VERSION}/$NODEJS_VERSION/g"   \
    docker/Dockerfile.template > $DOCKERFILE

echo "Building Docker image for Variety tests…"
sudo docker build --no-cache --tag $DOCKERIMAGE -f $DOCKERFILE .
#sudo docker build --tag $DOCKERIMAGE -f $DOCKERFILE .

sudo docker run --rm --tty --volume $VARIETY_SOURCECODE_PATH:/opt/variety --name $CONTAINER $DOCKERIMAGE
