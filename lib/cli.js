// @ts-nocheck
'use strict';

const fs = require('fs');
const packageMetadata = require('../package.json');
const { CliUsageError, createExecutionPlan, formatUsage } = require('./cli-options');
const { CliRuntimeError, buildShellInvocation, runShellInvocation } = require('./mongo-shell');

const writeLine = (stream, message) => {
  fs.writeSync(stream.fd, `${message}\n`);
};

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

    throw error;
  }
};

module.exports = {
  main,
};
