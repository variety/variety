// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import { chmod, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const cliOptionsModule = /** @type {typeof import('../../../cli/options.js')} */ (require('../../../cli/options.js'));
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const mongoShellModule = /** @type {typeof import('../../../mongo-shell/launcher.js')} */ (require('../../../mongo-shell/launcher.js'));

const {
  CliUsageError,
  createExecutionPlan,
  formatUsage,
  stripMatchingOuterQuotes,
} = cliOptionsModule;
const { buildShellInvocation } = mongoShellModule;

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

describe('CLI option parsing', () => {
  it('builds a CLI execution plan with bundled variety.js by default', () => {
    const plan = createExecutionPlan([
      'sales/orders',
      '--limit', '25',
      '--maxDepth', '4',
      '--outputFormat', 'json',
      '--query', '{"status":"open"}',
      '--sort', '{"updatedAt":-1}',
      '--eval', 'var plugins = "csv"',
    ], {});

    assert.deepEqual(plan, {
      database: 'sales',
      evalCode: 'var collection = "orders"; var query = {"status":"open"}; var sort = {"updatedAt":-1}; var limit = 25; var maxDepth = 4; var outputFormat = "json"; var plugins = "csv"',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {},
    });
  });

  it('includes maxExamples in the execution plan when specified', () => {
    const plan = createExecutionPlan([
      'sales/orders',
      '--max-examples', '3',
    ], {});

    assert.deepEqual(plan, {
      database: 'sales',
      evalCode: 'var collection = "orders"; var maxExamples = 3',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {},
    });
  });

  it('keeps zero-valued analysis options while requiring a positive port', () => {
    const plan = createExecutionPlan([
      'sales/orders',
      '--limit', '0',
      '--maxDepth', '0',
    ], {});

    assert.deepEqual(plan, {
      database: 'sales',
      evalCode: 'var collection = "orders"; var limit = 0; var maxDepth = 0',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {},
    });

    assert.throws(
      () => {
        createExecutionPlan(['sales/orders', '--port', '0'], {});
      },
      /--port must be a positive integer/
    );
  });

  it('keeps the documented env-var compatibility mode available', () => {
    const plan = createExecutionPlan([], {
      DB: 'testdb',
      EVAL_CMDS: '"var collection = \'users\', limit = 2"',
      VARIETYJS_DIR: '/tmp/custom-variety',
    });

    assert.deepEqual(plan, {
      database: 'testdb',
      evalCode: 'var collection = \'users\', limit = 2',
      mode: 'compatibility',
      scriptPath: '/tmp/custom-variety/variety.js',
      shellOptions: {},
    });
  });

  it('renders Mongo shell arguments in the expected order', () => {
    return (async () => {
      const shellDir = await mkdtemp(path.join(tmpdir(), 'variety-cli-options-'));
      const shellPath = path.join(shellDir, 'mongosh');

      try {
        await writeFile(shellPath, '#!/bin/sh\nexit 0\n');
        await chmod(shellPath, 0o755);

        const invocation = buildShellInvocation({
          database: 'appdb',
          evalCode: 'var collection = "users"',
          scriptPath: '/tmp/variety.js',
          shellOptions: {
            authenticationDatabase: 'admin',
            host: 'localhost',
            password: 'secret',
            port: 27018,
            quiet: true,
            username: 'alice',
          },
        }, {
          PATH: shellDir,
        });

        assert.deepEqual(invocation.args, [
          '--host', 'localhost',
          '--port', '27018',
          'appdb',
          '--quiet',
          '--username', 'alice',
          '--password', 'secret',
          '--authenticationDatabase', 'admin',
          '--eval', 'var collection = "users"',
          '/tmp/variety.js',
        ]);
      } finally {
        await rm(shellDir, { recursive: true, force: true });
      }
    })();
  });

  it('throws a usage error when the target is missing', () => {
    assert.throws(
      () => {
        createExecutionPlan([], {});
      },
      CliUsageError
    );
  });

  it('throws a usage error for malformed JSON flags', () => {
    assert.throws(
      () => {
        createExecutionPlan(['test/users', '--query', '{broken-json}'], {});
      },
      /--query must be strict JSON/
    );
  });

  it('strips only matching outer quotes in compatibility eval input', () => {
    assert.equal(stripMatchingOuterQuotes('"hello"'), 'hello');
    assert.equal(stripMatchingOuterQuotes('\'hello\''), 'hello');
    assert.equal(stripMatchingOuterQuotes('"hello\''), '"hello\'');
  });

  it('documents the compatibility mode in help output', () => {
    const helpText = formatUsage();

    assert.match(helpText, /variety DB\/COLLECTION \[options\]/);
    assert.match(helpText, /DB=test EVAL_CMDS=/);
    assert.match(helpText, /backwards compatibility/);
  });

  it('includes boolean variety options in the execution plan', () => {
    const plan = createExecutionPlan([
      'test/users',
      '--lastValue',
      '--showArrayElements',
      '--compactArrayTypes',
      '--logKeysContinuously',
      '--slaveOk',
      '--persistResults',
    ], {});

    assert.deepEqual(plan, {
      database: 'test',
      evalCode: 'var collection = "users"; var lastValue = true; var showArrayElements = true; var compactArrayTypes = true; var logKeysContinuously = true; var slaveOk = true; var persistResults = true',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {},
    });
  });

  it('includes string variety options in the execution plan', () => {
    const plan = createExecutionPlan([
      'test/users',
      '--arrayEscape', 'YY',
      '--plugins', '/path/to/my-plugin.js',
      '--resultsDatabase', 'variety_results',
      '--resultsCollection', 'usersKeys',
      '--resultsUser', 'admin',
      '--resultsPass', 'secret',
    ], {});

    assert.deepEqual(plan, {
      database: 'test',
      evalCode: 'var collection = "users"; var arrayEscape = "YY"; var resultsDatabase = "variety_results"; var resultsCollection = "usersKeys"; var resultsUser = "admin"; var resultsPass = "secret"; var plugins = "/path/to/my-plugin.js"',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {},
    });
  });

  it('includes excludeSubkeys JSON array in the execution plan', () => {
    const plan = createExecutionPlan([
      'test/users',
      '--excludeSubkeys', '["someNestedObject.a.b","otherPath"]',
    ], {});

    assert.deepEqual(plan, {
      database: 'test',
      evalCode: 'var collection = "users"; var excludeSubkeys = ["someNestedObject.a.b","otherPath"]',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {},
    });
  });

  it('throws a usage error for non-array excludeSubkeys input', () => {
    assert.throws(
      () => {
        createExecutionPlan(['test/users', '--excludeSubkeys', '{"key":"value"}'], {});
      },
      /--excludeSubkeys must be a JSON array/
    );
  });

  it('accepts kebab-case aliases for new options', () => {
    const plan = createExecutionPlan([
      'test/users',
      '--show-array-elements',
      '--compact-array-types',
      '--log-keys-continuously',
      '--slave-ok',
      '--persist-results',
      '--array-escape', 'ZZ',
      '--exclude-subkeys', '["a.b"]',
      '--last-value',
      '--results-database', 'mydb',
      '--results-collection', 'mycol',
      '--results-user', 'u',
      '--results-pass', 'p',
    ], {});

    assert.deepEqual(plan, {
      database: 'test',
      evalCode: 'var collection = "users"; var lastValue = true; var showArrayElements = true; var compactArrayTypes = true; var arrayEscape = "ZZ"; var excludeSubkeys = ["a.b"]; var logKeysContinuously = true; var slaveOk = true; var persistResults = true; var resultsDatabase = "mydb"; var resultsCollection = "mycol"; var resultsUser = "u"; var resultsPass = "p"',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {},
    });
  });

  it('documents new options in help output', () => {
    const helpText = formatUsage();

    assert.match(helpText, /--showArrayElements/);
    assert.match(helpText, /--compactArrayTypes/);
    assert.match(helpText, /--excludeSubkeys/);
    assert.match(helpText, /--logKeysContinuously/);
    assert.match(helpText, /--slaveOk/);
    assert.match(helpText, /--persistResults/);
    assert.match(helpText, /--resultsDatabase/);
    assert.match(helpText, /--resultsCollection/);
    assert.match(helpText, /--resultsUser/);
    assert.match(helpText, /--resultsPass/);
    assert.match(helpText, /--plugins/);
    assert.match(helpText, /--lastValue/);
    assert.match(helpText, /--arrayEscape/);
  });
});
