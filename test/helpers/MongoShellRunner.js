// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
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

/** @type {Promise<string> | undefined} */
let mongoShellCommandPromise;

/**
 * @param {string | Buffer | undefined} value
 * @returns {string}
 */
const toOutputText = (value) => value ? String(value) : '';

/**
 * @returns {Promise<string>}
 */
const findMongoShellCommand = async () => {
  if (!mongoShellCommandPromise) {
    if (process.env['MONGO_SHELL_COMMAND']) {
      mongoShellCommandPromise = Promise.resolve(process.env['MONGO_SHELL_COMMAND']);
    } else {
      mongoShellCommandPromise = execFile('sh', ['-lc', `
        if command -v mongosh >/dev/null 2>&1; then
          printf mongosh
        elif command -v mongo >/dev/null 2>&1; then
          printf mongo
        else
          printf 'Neither mongosh nor mongo is available in PATH.' >&2
          exit 127
        fi
      `]).then((result) => toOutputText(result.stdout).trim());
    }
  }

  return mongoShellCommandPromise;
};

/** Patterns that appear in mongosh output when it cannot reach the server. */
const CONNECTION_FAILURE_PATTERNS = [
  'MongoServerSelectionError',
  'MongoNetworkError',
  'ECONNREFUSED',
  'Connection refused',
  'failed to connect',
  'Could not connect',
  'Unable to reach',
  'getaddrinfo',
];

/**
 * @param {string} output
 * @returns {boolean}
 */
const looksLikeConnectionFailure = (output) =>
  CONNECTION_FAILURE_PATTERNS.some((p) => output.toLowerCase().includes(p.toLowerCase()));

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
  const command = await findMongoShellCommand();
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
    const result = await execFile(command, commandArgs);
    return toOutputText(result.stdout).trim();
  } catch (error) {
    /** @type {Error & { stderr?: string | Buffer, stdout?: string | Buffer }} */
    const execError = /** @type {Error & { stderr?: string | Buffer, stdout?: string | Buffer }} */ (error);

    // mongosh reports thrown script errors on stderr; keep the legacy stdout
    // contract that the specs already assert against.
    if (execError.stderr) {
      execError.stdout = [toOutputText(execError.stdout), toOutputText(execError.stderr)]
        .filter(Boolean)
        .join('\n');
    }

    // Distinguish a mongod connectivity failure from a variety.js script error
    // so callers see "MongoDB unreachable on port N" rather than a confusing
    // "expected stdout to include <variety error>" assertion mismatch.
    const fullOutput = toOutputText(execError.stdout);
    if (looksLikeConnectionFailure(fullOutput)) {
      const connErr = new Error(
        `mongosh could not connect to MongoDB on port ${port} — ` +
        `the server may have crashed. mongosh output: ${fullOutput}`
      );
      throw connErr;
    }

    throw execError;
  }
};
