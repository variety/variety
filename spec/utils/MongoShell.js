'use strict';

import { execFile } from 'promisify-child-process';

let mongoShellCommandPromise;

const findMongoShellCommand = async () => {
  if (!mongoShellCommandPromise) {
    mongoShellCommandPromise = execFile('sh', ['-lc', `
      if command -v mongosh >/dev/null 2>&1; then
        printf mongosh
      elif command -v mongo >/dev/null 2>&1; then
        printf mongo
      else
        printf 'Neither mongosh nor mongo is available in PATH.' >&2
        exit 127
      fi
    `]).then((result) => result.stdout.trim());
  }

  return mongoShellCommandPromise;
};

export default async (database, credentials, args, script, quiet, port) => {
  const command = await findMongoShellCommand();
  const commandArgs = [];

  commandArgs.push('--port');
  commandArgs.push(String(port));

  if (database) {
    commandArgs.push(database);
  }
  if (quiet) {
    commandArgs.push('--quiet');
  }

  if (credentials) {
    commandArgs.push('--username');
    commandArgs.push(credentials.username);
    commandArgs.push('--password');
    commandArgs.push(credentials.password);
    commandArgs.push('--authenticationDatabase');
    commandArgs.push(credentials.authDatabase);
  }

  if (args) {
    commandArgs.push('--eval');
    commandArgs.push(args);
  }

  if (script) {
    commandArgs.push(script);
  }

  try {
    const result = await execFile(command, commandArgs);
    return result.stdout.trim();
  } catch (error) {
    // mongosh reports thrown script errors on stderr; keep the legacy stdout
    // contract that the specs already assert against.
    if (error.stderr) {
      error.stdout = [error.stdout, error.stderr].filter(Boolean).join('\n');
    }
    throw error;
  }
};
