FROM mongo:{MONGODB_VERSION}

RUN apt-get -qq update
RUN apt-get install -y --force-yes --no-install-recommends curl

# This is the recommended installation of node
# See: https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions
# RUN curl -sL https://deb.nodesource.com/setup_5.x | bash -
# RUN apt-get install -y --force-yes --no-install-recommends nodejs

# To speed up the installation, we skip packages and download directly node archive
# Version of node is determinded by Heroku's API https://semver.io/node/stable
RUN NODE_VERSION=$(curl -sk https://semver.io/node/stable) \
  && curl -SLO "http://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
  && tar -xzf "node-v$NODE_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
  && rm "node-v$NODE_VERSION-linux-x64.tar.gz"

ENTRYPOINT ["/opt/variety/docker/start-script.sh"]
