// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import { readFileSync } from 'fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'promisify-child-process';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const binVarietyPath = fileURLToPath(new URL('../../../bin/variety', import.meta.url));
/** @typedef {{ version: string }} PackageMetadata */
const rawPackageMetadata = /** @type {unknown} */ (
  JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
);
const packageMetadata = /** @type {PackageMetadata} */ (rawPackageMetadata);

/**
 * @typedef {{
 *   command: string,
 *   args: string[],
 * }} ShellInvocation
 */

/**
 * @param {string} shellDir
 * @param {string} shellName
 */
const createFakeShell = async (shellDir, shellName) => {
  const shellPath = path.join(shellDir, shellName);
  await writeFile(shellPath, `#!/bin/bash
set -e
: "\${FAKE_SHELL_ARGS_FILE:?}"
{
  printf '%s\n' "\${0##*/}"
  printf '%s\n' "$@"
} > "$FAKE_SHELL_ARGS_FILE"
printf 'fake shell ran\n'
`);
  await chmod(shellPath, 0o755);
};

/**
 * @param {string} recordPath
 * @returns {Promise<ShellInvocation>}
 */
const readInvocation = async (recordPath) => {
  const recordedArgs = (await readFile(recordPath, 'utf8'))
    .split('\n')
    .filter((line) => line.length > 0);

  const [command, ...args] = recordedArgs;
  if (!command) {
    throw new Error('Expected fake shell to record a command.');
  }

  return { command, args };
};

/**
 * @param {{
 *   shells?: string[],
 *   args?: string[],
 *   env?: NodeJS.ProcessEnv,
 *   includeSystemPath?: boolean,
 * }} [options]
 */
const runBinVariety = async (options = {}) => {
  const shellNames = options.shells || ['mongosh'];
  const args = options.args || [];
  const env = options.env || {};
  const includeSystemPath = typeof options.includeSystemPath === 'undefined' ? true : options.includeSystemPath;
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'variety-bin-wrapper-'));
  const recordPath = path.join(fixtureDir, 'invocation.txt');

  try {
    for (const shellName of shellNames) {
      await createFakeShell(fixtureDir, shellName);
    }

    const result = await execFile(process.execPath, [binVarietyPath, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
        FAKE_SHELL_ARGS_FILE: recordPath,
        PATH: [fixtureDir, includeSystemPath ? process.env['PATH'] || '' : ''].filter(Boolean).join(path.delimiter),
      },
    });

    return {
      stderr: String(result.stderr || ''),
      stdout: String(result.stdout || ''),
      invocation: await readInvocation(recordPath).catch(() => null),
    };
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
};

describe('bin/variety wrapper', () => {
  it('supports the db/collection CLI target plus core analysis flags', async () => {
    const { invocation, stderr } = await runBinVariety({
      args: [
        'testdb/users',
        '--limit', '5',
        '--maxDepth=3',
        '--output-format', 'json',
      ],
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation, {
      command: 'mongosh',
      args: [
        'testdb',
        '--eval',
        'var collection = "users"; var limit = 5; var maxDepth = 3; var outputFormat = "json"',
        path.join(repoRoot, 'variety.js'),
      ],
    });
    assert.equal(stderr, '');
  });

  it('passes through connection flags and appends extra eval code', async () => {
    const { invocation } = await runBinVariety({
      args: [
        'analytics/events',
        '--host', 'localhost',
        '--port', '27017',
        '--username', 'alice',
        '--password', 'secret',
        '--authenticationDatabase', 'admin',
        '--quiet',
        '--query', '{"type":"pageview"}',
        '--sort', '{"updatedAt":-1}',
        '--eval', 'var plugins = "custom"',
      ],
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation, {
      command: 'mongosh',
      args: [
        '--host', 'localhost',
        '--port', '27017',
        'analytics',
        '--quiet',
        '--username', 'alice',
        '--password', 'secret',
        '--authenticationDatabase', 'admin',
        '--eval',
        'var collection = "events"; var query = {"type":"pageview"}; var sort = {"updatedAt":-1}; var plugins = "custom"',
        path.join(repoRoot, 'variety.js'),
      ],
    });
  });

  it('prefers mongosh and preserves the documented DB plus EVAL_CMDS compatibility mode', async () => {
    const { invocation, stdout, stderr } = await runBinVariety({
      shells: ['mongosh', 'mongo'],
      env: {
        DB: 'testdb',
        EVAL_CMDS: 'var collection = \'users\', limit = 1',
      },
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation, {
      command: 'mongosh',
      args: ['testdb', '--eval', 'var collection = \'users\', limit = 1', './variety.js'],
    });
    assert.equal(stdout.includes('fake shell ran'), true);
    assert.equal(stderr, '');
  });

  it('falls back to mongo and honors VARIETYJS_DIR', async () => {
    const varietyDir = '/tmp/custom-variety-dir';
    const { invocation } = await runBinVariety({
      includeSystemPath: false,
      shells: ['mongo'],
      env: {
        VARIETYJS_DIR: varietyDir,
      },
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation, {
      command: 'mongo',
      args: [`${varietyDir}/variety.js`],
    });
  });

  it('removes matching outer double quotes from EVAL_CMDS', async () => {
    const { invocation } = await runBinVariety({
      env: {
        EVAL_CMDS: '"var collection = \'users\', limit = 2"',
      },
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation.args, ['--eval', 'var collection = \'users\', limit = 2', './variety.js']);
  });

  it('removes matching outer single quotes from EVAL_CMDS', async () => {
    const { invocation } = await runBinVariety({
      env: {
        EVAL_CMDS: '\'var collection = "users", limit = 2\'',
      },
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation.args, ['--eval', 'var collection = "users", limit = 2', './variety.js']);
  });

  it('preserves unmatched outer quotes in EVAL_CMDS', async () => {
    const evalCommands = '"var collection = \'users\'';
    const { invocation } = await runBinVariety({
      env: {
        EVAL_CMDS: evalCommands,
      },
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation.args, ['--eval', evalCommands, './variety.js']);
  });

  it('fails with exit 127 when neither shell is available', async () => {
    await assert.rejects(
      () => runBinVariety({
        args: ['test/users'],
        includeSystemPath: false,
        shells: [],
      }),
      /** @param {NodeJS.ErrnoException & { stderr?: string | Buffer }} error */
      (error) => {
        assert.equal(error.code, 127);
        assert.match(String(error.stderr || ''), /neither mongosh nor mongo found in PATH/);
        return true;
      }
    );
  });

  it('prints help without invoking a Mongo shell', async () => {
    const { invocation, stdout, stderr } = await runBinVariety({
      args: ['--help'],
      shells: [],
    });

    assert.equal(invocation, null);
    assert.match(stdout, /Usage:/);
    assert.equal(stderr, '');
  });

  it('prints the package version without invoking a Mongo shell', async () => {
    const { invocation, stdout, stderr } = await runBinVariety({
      args: ['--version'],
      shells: [],
    });

    assert.equal(invocation, null);
    assert.equal(stdout.trim(), packageMetadata.version);
    assert.equal(stderr, '');
  });

  it('passes array analysis flags through to the mongosh eval arg', async () => {
    const { invocation } = await runBinVariety({
      args: [
        'testdb/events',
        '--show-array-elements',
        '--compact-array-types',
        '--array-escape', 'YY',
        '--exclude-subkeys', 'meta.tags',
        '--exclude-subkeys', 'audit.log',
        '--log-keys-continuously',
      ],
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation, {
      command: 'mongosh',
      args: [
        'testdb',
        '--eval',
        'var collection = "events"; var showArrayElements = true; var compactArrayTypes = true; var arrayEscape = "YY"; var excludeSubkeys = ["meta.tags","audit.log"]; var logKeysContinuously = true',
        path.join(repoRoot, 'variety.js'),
      ],
    });
  });

  it('passes persistence flags through to the mongosh eval arg', async () => {
    const { invocation } = await runBinVariety({
      args: [
        'testdb/orders',
        '--persist-results',
        '--results-database', 'db.example.com/variety',
        '--results-collection', 'orderKeys',
        '--results-user', 'reporter',
        '--results-password', 'secret',
      ],
    });

    if (!invocation) {
      throw new Error('Expected the fake shell invocation to be recorded.');
    }
    assert.deepEqual(invocation, {
      command: 'mongosh',
      args: [
        'testdb',
        '--eval',
        'var collection = "orders"; var persistResults = true; var resultsDatabase = "db.example.com/variety"; var resultsCollection = "orderKeys"; var resultsUser = "reporter"; var resultsPass = "secret"',
        path.join(repoRoot, 'variety.js'),
      ],
    });
  });

  it('fails fast on invalid JSON query input', async () => {
    await assert.rejects(
      () => runBinVariety({
        args: ['test/users', '--query', '{bad-json}'],
      }),
      /** @param {NodeJS.ErrnoException & { stderr?: string | Buffer }} error */
      (error) => {
        assert.equal(error.code, 2);
        assert.match(String(error.stderr || ''), /--query must be strict JSON/);
        return true;
      }
    );
  });
});
