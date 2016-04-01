'use strict';

import { exec } from 'child-process-promise';

export default async (database, credentials, args, script, quiet, port) => {
  const commands = ['mongo'];

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

  const result = await exec(commands.join(' '));
  return result.stdout.trim();
};
