// @ts-check
'use strict';

import { execFile } from 'promisify-child-process';

/**
 * @typedef {{
 *   username: string,
 *   password: string,
 *   authDatabase: string
 * }} MongoShellCredentials
 */

/**
 * @param {string | Buffer | undefined} value
 * @returns {string}
 */
const toOutputText = (value) => value ? String(value) : '';

/**
 * @param {string | undefined} database
 * @param {MongoShellCredentials | null} credentials
 * @param {string | undefined} args
 * @param {string | undefined} script
 * @param {boolean | undefined} quiet
 * @param {number} port
 * @returns {Promise<string>}
 */
export default async (database, credentials, args, script, quiet, port) => {
  /** @type {string[]} */
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
    const result = await execFile('mongosh', commandArgs);
    return toOutputText(result.stdout).trim();
  } catch (error) {
    /** @type {Error & { stderr?: string | Buffer, stdout?: string | Buffer }} */
    const execError = /** @type {Error & { stderr?: string | Buffer, stdout?: string | Buffer }} */ (error);

    // mongosh reports thrown script errors on stderr; keep the stdout
    // contract that the specs already assert against.
    if (execError.stderr) {
      execError.stdout = [toOutputText(execError.stdout), toOutputText(execError.stderr)]
        .filter(Boolean)
        .join('\n');
    }
    throw execError;
  }
};
