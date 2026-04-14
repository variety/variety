import assert from 'assert';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'promisify-child-process';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binVarietyPath = fileURLToPath(new URL('../bin/variety', import.meta.url));

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
 *   env?: NodeJS.ProcessEnv,
 * }} [options]
 */
const runBinVariety = async (options = {}) => {
  const shellNames = options.shells || ['mongosh'];
  const env = options.env || {};
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'variety-bin-wrapper-'));
  const recordPath = path.join(fixtureDir, 'invocation.txt');

  try {
    for (const shellName of shellNames) {
      await createFakeShell(fixtureDir, shellName);
    }

    const result = await execFile('/bin/bash', [binVarietyPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
        FAKE_SHELL_ARGS_FILE: recordPath,
        PATH: fixtureDir,
      },
    });

    return {
      stderr: String(result.stderr || ''),
      stdout: String(result.stdout || ''),
      invocation: await readInvocation(recordPath),
    };
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
};

describe('bin/variety wrapper', () => {
  it('prefers mongosh and forwards DB plus eval arguments', async () => {
    const { invocation, stdout, stderr } = await runBinVariety({
      shells: ['mongosh', 'mongo'],
      env: {
        DB: 'testdb',
        EVAL_CMDS: 'var collection = \'users\', limit = 1',
      },
    });

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
      shells: ['mongo'],
      env: {
        VARIETYJS_DIR: varietyDir,
      },
    });

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

    assert.deepEqual(invocation.args, ['--eval', 'var collection = \'users\', limit = 2', './variety.js']);
  });

  it('removes matching outer single quotes from EVAL_CMDS', async () => {
    const { invocation } = await runBinVariety({
      env: {
        EVAL_CMDS: '\'var collection = "users", limit = 2\'',
      },
    });

    assert.deepEqual(invocation.args, ['--eval', 'var collection = "users", limit = 2', './variety.js']);
  });

  it('preserves unmatched outer quotes in EVAL_CMDS', async () => {
    const evalCommands = '"var collection = \'users\'';
    const { invocation } = await runBinVariety({
      env: {
        EVAL_CMDS: evalCommands,
      },
    });

    assert.deepEqual(invocation.args, ['--eval', evalCommands, './variety.js']);
  });

  it('fails with exit 127 when neither shell is available', async () => {
    await assert.rejects(
      () => runBinVariety({ shells: [] }),
      /** @param {NodeJS.ErrnoException & { stderr?: string | Buffer }} error */
      (error) => {
        assert.equal(error.code, 127);
        assert.match(String(error.stderr || ''), /neither mongosh nor mongo found in PATH/);
        return true;
      }
    );
  });
});
