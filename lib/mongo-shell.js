// @ts-nocheck
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CliRuntimeError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'CliRuntimeError';
    this.exitCode = exitCode;
  }
}

const isExecutable = (filePath) => {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const findCommandOnPath = (commandName, envPath) => {
  if (!envPath) {
    return null;
  }

  return envPath
    .split(path.delimiter)
    .filter((directory) => directory.length > 0)
    .map((directory) => path.join(directory, commandName))
    .find((candidatePath) => isExecutable(candidatePath)) || null;
};

const selectMongoShell = (env) => {
  const mongoshPath = findCommandOnPath('mongosh', env.PATH || '');
  if (mongoshPath) {
    return mongoshPath;
  }

  const mongoPath = findCommandOnPath('mongo', env.PATH || '');
  if (mongoPath) {
    return mongoPath;
  }

  throw new CliRuntimeError('Error: neither mongosh nor mongo found in PATH', 127);
};

const buildShellInvocation = (plan, env) => {
  const command = selectMongoShell(env);
  const args = [];
  const shellOptions = plan.shellOptions || {};

  if (shellOptions.host) {
    args.push('--host', shellOptions.host);
  }

  if (typeof shellOptions.port === 'number') {
    args.push('--port', String(shellOptions.port));
  }

  if (plan.database) {
    args.push(plan.database);
  }

  if (shellOptions.quiet === true) {
    args.push('--quiet');
  }

  if (shellOptions.username) {
    args.push('--username', shellOptions.username);
  }

  if (shellOptions.password) {
    args.push('--password', shellOptions.password);
  }

  if (shellOptions.authenticationDatabase) {
    args.push('--authenticationDatabase', shellOptions.authenticationDatabase);
  }

  if (plan.evalCode) {
    args.push('--eval', plan.evalCode);
  }

  args.push(plan.scriptPath);

  return { args, command };
};

const runShellInvocation = (invocation, env) => {
  const result = spawnSync(invocation.command, invocation.args, {
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new CliRuntimeError(result.error.message);
  }

  return typeof result.status === 'number' ? result.status : 1;
};

module.exports = {
  CliRuntimeError,
  buildShellInvocation,
  findCommandOnPath,
  runShellInvocation,
  selectMongoShell,
};
