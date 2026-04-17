// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2012–2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
'use strict';

const fs = require('fs');
const path = require('path');
/** @typedef {{ fd: number }} FdWritableStream */
/** @typedef {{ version: string }} PackageMetadata */
const rawPackageMetadata = /** @type {unknown} */ (
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
);
const packageMetadata = /** @type {PackageMetadata} */ (rawPackageMetadata);
const cliOptions = /** @type {typeof import('./options.js')} */ (require('./options'));
const mongoShell = /** @type {typeof import('../mongo-shell/launcher.js')} */ (require('../mongo-shell/launcher'));
const { CliUsageError, createExecutionPlan, formatUsage } = cliOptions;
const { CliRuntimeError, buildShellInvocation, runShellInvocation } = mongoShell;

/**
 * @param {FdWritableStream} stream
 * @param {string} message
 * @returns {void}
 */
const writeLine = (stream, message) => {
  fs.writeSync(stream.fd, `${message}\n`);
};

/**
 * @param {string[]} [argv=process.argv.slice(2)]
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {FdWritableStream} [stdout=process.stdout]
 * @param {FdWritableStream} [stderr=process.stderr]
 * @returns {number}
 */
const main = (argv = process.argv.slice(2), env = process.env, stdout = process.stdout, stderr = process.stderr) => {
  try {
    const executionPlan = createExecutionPlan(argv, env);

    if (executionPlan.mode === 'help') {
      writeLine(stdout, formatUsage());
      return 0;
    }

    if (executionPlan.mode === 'version') {
      writeLine(stdout, packageMetadata.version);
      return 0;
    }

    return runShellInvocation(buildShellInvocation(executionPlan, env), env);
  } catch (error) {
    if (error instanceof CliUsageError) {
      writeLine(stderr, `Error: ${error.message}`);
      writeLine(stderr, '');
      writeLine(stderr, formatUsage());
      return error.exitCode;
    }

    if (error instanceof CliRuntimeError) {
      writeLine(stderr, error.message);
      return error.exitCode;
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(String(error), { cause: error });
  }
};

module.exports = {
  main,
};
