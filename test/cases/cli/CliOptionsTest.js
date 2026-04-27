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

/**
 * @param {unknown} plan
 * @returns {string}
 */
const evalCodeOf = (plan) => {
  if (!plan || typeof plan !== 'object' || !('evalCode' in plan) || typeof plan['evalCode'] !== 'string') {
    throw new Error('Expected a runnable execution plan');
  }
  return plan['evalCode'];
};

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
      evalCode: 'var collection = "orders"; var query = {"status":"open"}; var limit = 25; var maxDepth = 4; var sort = {"updatedAt":-1}; var outputFormat = "json"; var plugins = "csv"',
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

  it('renders Mongo shell URI arguments in the expected order', () => {
    return (async () => {
      const shellDir = await mkdtemp(path.join(tmpdir(), 'variety-cli-options-uri-'));
      const shellPath = path.join(shellDir, 'mongosh');

      try {
        await writeFile(shellPath, '#!/bin/sh\nexit 0\n');
        await chmod(shellPath, 0o755);

        const invocation = buildShellInvocation({
          database: 'app',
          evalCode: 'var collection = "users"',
          scriptPath: '/tmp/variety.js',
          shellOptions: {
            quiet: true,
            uri: 'mongodb://db.example.com/app?authSource=admin',
          },
        }, {
          PATH: shellDir,
        });

        assert.deepEqual(invocation.args, [
          'mongodb://db.example.com/app?authSource=admin',
          '--quiet',
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

  it('passes through --eval values that start with -- when they are not known CLI flags', () => {
    const plan = createExecutionPlan(['test/users', '--eval', '--custom-eval-token'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; --custom-eval-token');
  });

  it('accepts inline --eval values even when they look like known CLI flags', () => {
    const plan = createExecutionPlan(['test/users', '--eval=--quiet'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; --quiet');
  });

  it('rejects known CLI flags immediately after --eval with guidance', () => {
    assert.throws(
      () => {
        createExecutionPlan(['test/users', '--eval', '--quiet'], {});
      },
      /--eval expected JavaScript, but received Variety CLI flag "--quiet".*place it before --eval.*--eval=--quiet/s
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
    assert.match(helpText, /--uri <mongodb-uri>/);
  });

  it('supports --uri and injects the positional database when the URI omits one', () => {
    const plan = createExecutionPlan([
      'app/users',
      '--uri', 'mongodb+srv://cluster.example.com/?retryWrites=true&w=majority',
      '--quiet',
    ], {});

    assert.deepEqual(plan, {
      database: 'app',
      evalCode: 'var collection = "users"',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {
        quiet: true,
        uri: 'mongodb+srv://cluster.example.com/app?retryWrites=true&w=majority',
      },
    });
  });

  it('accepts a --uri whose database already matches the positional target', () => {
    const plan = createExecutionPlan([
      'app/users',
      '--uri', 'mongodb://db.example.com/app?authSource=admin',
    ], {});

    assert.deepEqual(plan, {
      database: 'app',
      evalCode: 'var collection = "users"',
      mode: 'cli',
      scriptPath: path.join(repoRoot, 'variety.js'),
      shellOptions: {
        uri: 'mongodb://db.example.com/app?authSource=admin',
      },
    });
  });

  it('rejects --uri when its database disagrees with the positional target', () => {
    assert.throws(
      () => {
        createExecutionPlan([
          'app/users',
          '--uri', 'mongodb://db.example.com/other?authSource=admin',
        ], {});
      },
      /does not match positional DB "app"/
    );
  });

  it('rejects combining --uri with host or auth flags', () => {
    assert.throws(
      () => {
        createExecutionPlan([
          'app/users',
          '--uri', 'mongodb://db.example.com/app',
          '--host', 'localhost',
        ], {});
      },
      /uri cannot be combined with host/
    );

    assert.throws(
      () => {
        createExecutionPlan([
          'app/users',
          '--uri', 'mongodb://db.example.com/app',
          '--username', 'alice',
          '--password', 'secret',
          '--authenticationDatabase', 'admin',
        ], {});
      },
      /uri cannot be combined with username, password, authenticationDatabase/
    );
  });

  it('emits showArrayElements when the flag is passed', () => {
    const plan = createExecutionPlan(['test/users', '--show-array-elements'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var showArrayElements = true');
  });

  it('emits hideFrequencyColumns when the flag is passed', () => {
    const plan = createExecutionPlan(['test/users', '--hide-frequency-columns'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var hideFrequencyColumns = true');
  });

  it('emits compactArrayTypes when the flag is passed', () => {
    const plan = createExecutionPlan(['test/users', '--compact-array-types'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var compactArrayTypes = true');
  });

  it('emits logKeysContinuously when the flag is passed', () => {
    const plan = createExecutionPlan(['test/users', '--log-keys-continuously'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var logKeysContinuously = true');
  });

  it('accepts camelCase boolean flag names as well as kebab aliases', () => {
    const kebab = createExecutionPlan(['test/users', '--show-array-elements=false'], {});
    const camel = createExecutionPlan(['test/users', '--showArrayElements=false'], {});
    assert.equal(evalCodeOf(kebab), evalCodeOf(camel));
    assert.equal(evalCodeOf(kebab), 'var collection = "users"; var showArrayElements = false');
  });

  it('accepts --hideFrequencyColumns camelCase alias', () => {
    const kebab = createExecutionPlan(['test/users', '--hide-frequency-columns=false'], {});
    const camel = createExecutionPlan(['test/users', '--hideFrequencyColumns=false'], {});
    assert.equal(evalCodeOf(kebab), evalCodeOf(camel));
    assert.equal(evalCodeOf(kebab), 'var collection = "users"; var hideFrequencyColumns = false');
  });

  it('emits arrayEscape with the supplied value', () => {
    const plan = createExecutionPlan(['test/users', '--array-escape', 'YY'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var arrayEscape = "YY"');
  });

  it('rejects an empty --arrayEscape value', () => {
    assert.throws(
      () => {
        createExecutionPlan(['test/users', '--array-escape', ''], {});
      },
      /--arrayEscape must not be empty/
    );
  });

  it('accumulates a single --exclude-subkeys path', () => {
    const plan = createExecutionPlan(['test/users', '--exclude-subkeys', 'meta.tags'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var excludeSubkeys = ["meta.tags"]');
  });

  it('accumulates multiple --exclude-subkeys paths via repetition', () => {
    const plan = createExecutionPlan([
      'test/users',
      '--exclude-subkeys', 'meta.tags',
      '--exclude-subkeys', 'audit.log',
    ], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var excludeSubkeys = ["meta.tags","audit.log"]');
  });

  it('omits excludeSubkeys from eval when the flag is not passed', () => {
    const plan = createExecutionPlan(['test/users'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"');
  });

  it('emits persistResults when the flag is passed', () => {
    const plan = createExecutionPlan(['test/users', '--persist-results'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var persistResults = true');
  });

  it('emits all persistence options together', () => {
    const plan = createExecutionPlan([
      'test/users',
      '--persist-results',
      '--results-database', 'db.example.com/variety',
      '--results-collection', 'myKeys',
      '--results-user', 'reporter',
      '--results-password', 'secret',
    ], {});
    assert.equal(
      evalCodeOf(plan),
      'var collection = "users"; var persistResults = true; var resultsDatabase = "db.example.com/variety"; var resultsCollection = "myKeys"; var resultsUser = "reporter"; var resultsPass = "secret"'
    );
  });

  it('emits resultsDatabase alone without requiring persistResults', () => {
    const plan = createExecutionPlan(['test/users', '--resultsDatabase', 'mydb'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var resultsDatabase = "mydb"');
  });

  it('maps --results-password to var resultsPass', () => {
    const plan = createExecutionPlan(['test/users', '--results-password', 'hunter2'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var resultsPass = "hunter2"');
  });

  it('emits var plugins for a single --plugin without config', () => {
    const plan = createExecutionPlan(['test/users', '--plugin', '/path/to/plugin.js'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var plugins = "/path/to/plugin.js"');
  });

  it('converts ? to | when emitting var plugins', () => {
    const plan = createExecutionPlan(['test/users', '--plugin', '/path/to/plugin.js?delimiter=;'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var plugins = "/path/to/plugin.js|delimiter=;"');
  });

  it('joins multiple --plugin entries with commas', () => {
    const plan = createExecutionPlan([
      'test/users',
      '--plugin', '/path/to/a.js',
      '--plugin', '/path/to/b.js?key=val&other=x',
    ], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"; var plugins = "/path/to/a.js,/path/to/b.js|key=val&other=x"');
  });

  it('omits var plugins when no --plugin flag is passed', () => {
    const plan = createExecutionPlan(['test/users'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "users"');
  });

  it('emits lastValue when the flag is passed', () => {
    const plan = createExecutionPlan(['test/orders', '--last-value'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "orders"; var lastValue = true');
  });

  it('accepts --lastValue camelCase alias', () => {
    const plan = createExecutionPlan(['test/orders', '--lastValue=false'], {});
    assert.equal(evalCodeOf(plan), 'var collection = "orders"; var lastValue = false');
  });

  it('emits secondaryOk and accepts the camelCase alias', () => {
    const kebab = createExecutionPlan(['test/users', '--secondary-ok'], {});
    const camel = createExecutionPlan(['test/users', '--secondaryOk=false'], {});

    assert.equal(evalCodeOf(kebab), 'var collection = "users"; var secondaryOk = true');
    assert.equal(evalCodeOf(camel), 'var collection = "users"; var secondaryOk = false');
  });
});
