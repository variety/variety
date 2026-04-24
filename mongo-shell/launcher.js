// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {{
 *   authenticationDatabase?: string,
 *   host?: string,
 *   password?: string,
 *   port?: number,
 *   quiet?: boolean,
 *   uri?: string,
 *   username?: string,
 * }} ShellOptions
 */

/**
 * @typedef {{
 *   database: string,
 *   evalCode: string,
 *   scriptPath: string,
 *   shellOptions?: ShellOptions,
 * }} ShellExecutionPlan
 */

/**
 * @typedef {{
 *   args: string[],
 *   command: string,
 * }} ShellInvocation
 */

class CliRuntimeError extends Error {
  /**
   * @param {string} message
   * @param {number} [exitCode=1]
   */
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'CliRuntimeError';
    this.exitCode = exitCode;
  }
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isExecutable = (filePath) => {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * @param {string} commandName
 * @param {string} envPath
 * @returns {string | null}
 */
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

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
const selectMongoShell = (env) => {
  const envPath = env['PATH'] || '';
  const mongoshPath = findCommandOnPath('mongosh', envPath);
  if (mongoshPath) {
    return mongoshPath;
  }

  const mongoPath = findCommandOnPath('mongo', envPath);
  if (mongoPath) {
    return mongoPath;
  }

  throw new CliRuntimeError('Error: neither mongosh nor mongo found in PATH', 127);
};

/**
 * @param {ShellExecutionPlan} plan
 * @param {NodeJS.ProcessEnv} env
 * @returns {ShellInvocation}
 */
const buildShellInvocation = (plan, env) => {
  const command = selectMongoShell(env);
  const args = [];
  /** @type {ShellOptions} */
  const shellOptions = plan.shellOptions || {};

  if (shellOptions.host) {
    args.push('--host', shellOptions.host);
  }

  if (typeof shellOptions.port === 'number') {
    args.push('--port', String(shellOptions.port));
  }

  if (shellOptions.uri) {
    args.push(shellOptions.uri);
  } else if (plan.database) {
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

/**
 * @param {ShellInvocation} invocation
 * @param {NodeJS.ProcessEnv} env
 * @returns {number}
 */
const runShellInvocation = (invocation, env) => {
  const result = spawnSync(invocation.command, invocation.args, {
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
    throw new CliRuntimeError(errorMessage);
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
