'use strict';

const exec = require('child-process-promise').exec;

const execute = (database, credentials, args, script, quiet, port) => {
  let commands = ['mongo'];

  commands.push('--port');
  commands.push(port);

  if (database) {
    commands.push(database);
  }
  if (quiet) {
    commands.push('--quiet');
  }

  if (credentials) {
    commands.push('--username');
    commands.push(credentials.username);
    commands.push('--password');
    commands.push(credentials.password);
    commands.push('--authenticationDatabase');
    commands.push(credentials.authDatabase);
  }

  if (args) {
    commands.push('--eval');
    commands.push(args);
  }

  if (script) {
    commands.push(script);
  }

  return exec(commands.join(' '))
    .then(result => result.stdout.trim());
};

module.exports = {
  execute:execute
};
