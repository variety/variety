import assert from 'assert';
import { chmod, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const cliOptionsModule = /** @type {typeof import('../../lib/cli-options.js')} */ (require('../../lib/cli-options.js'));
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const mongoShellModule = /** @type {typeof import('../../lib/mongo-shell.js')} */ (require('../../lib/mongo-shell.js'));

const {
  CliUsageError,
  createExecutionPlan,
  formatUsage,
  stripMatchingOuterQuotes,
} = cliOptionsModule;
const { buildShellInvocation } = mongoShellModule;

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

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
});
