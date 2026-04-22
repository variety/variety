// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';

const adapterPath = fileURLToPath(new URL('../../../mongo-shell/adapter.js', import.meta.url));
const adapterSource = fs.readFileSync(adapterPath, 'utf8');

/**
 * @typedef {{ countDocuments(query: Record<string, unknown>, options?: { limit: number }): number }} FakeCollection
 * @typedef {{ name: string }} FakeDatabaseInfo
 * @typedef {{ databases?: FakeDatabaseInfo[] }} FakeListDatabasesResult
 * @typedef {{
 *   adminCommand(command: string): FakeListDatabasesResult,
 *   getCollection(name: string): FakeCollection,
 *   getCollectionNames(): string[],
 *   getMongo(): { setReadPref(mode: string): void },
 *   getName(): string,
 *   getSisterDB(name: string): never,
 * }} FakeDb
 */

/**
 * @param {string[]} sisterDbCalls
 * @param {{ setReadPref(mode: string): void }} [mongoConnection]
 * @returns {FakeDb}
 */
const createDb = (sisterDbCalls, mongoConnection = { setReadPref() {} }) => ({
  adminCommand(command) {
    assert.equal(command, 'listDatabases');
    return {
      databases: [
        { name: 'test' },
        { name: '' },
        { name: 'analytics' },
      ],
    };
  },
  getCollection(name) {
    assert.equal(name, 'users');
    return {
      countDocuments(query, options) {
        assert.deepEqual(query, {});
        assert.equal(options, undefined);
        return 1;
      },
    };
  },
  getCollectionNames() {
    return ['users'];
  },
  getMongo() {
    return mongoConnection;
  },
  getName() {
    return 'test';
  },
  getSisterDB(name) {
    sisterDbCalls.push(name);
    throw new Error(`Unexpected scan of database ${name}`);
  },
});

describe('Mongo shell adapter validation', () => {
  it('sets the secondary read preference before startup reads when secondaryOk is true', () => {
    /** @type {string[]} */
    const readPreferenceModes = [];
    /** @type {string[]} */
    const sisterDbCalls = [];
    let analyzerRan = false;

    const context = {
      __varietyImpl: {
        createKeyMap: () => ({}),
        run: () => {
          analyzerRan = true;
        },
        shellToJson: JSON.stringify,
      },
      collection: 'users',
      db: createDb(sisterDbCalls, {
        setReadPref(mode) {
          assert.equal(analyzerRan, false);
          readPreferenceModes.push(mode);
        },
      }),
      print: () => {},
      secondaryOk: true,
    };

    vm.createContext(context);
    vm.runInContext(adapterSource, context, { filename: adapterPath });

    assert.deepEqual(readPreferenceModes, ['secondary']);
    assert.equal(analyzerRan, true);
  });

  it('does not enumerate collections for unrelated databases during startup', () => {
    /** @type {unknown[]} */
    const runConfigs = [];
    /** @type {string[]} */
    const sisterDbCalls = [];
    /**
     * @returns {Record<string, unknown>}
     */
    const createKeyMap = () => ({});
    /**
     * @param {unknown} config
     */
    const captureRunConfig = (config) => {
      runConfigs.push(config);
    };

    const context = {
      __varietyImpl: {
        createKeyMap,
        run: captureRunConfig,
        shellToJson: JSON.stringify,
      },
      collection: 'users',
      db: createDb(sisterDbCalls),
      print: () => {},
    };

    vm.createContext(context);
    vm.runInContext(adapterSource, context, { filename: adapterPath });

    assert.deepEqual(sisterDbCalls, []);
    assert.equal(runConfigs.length, 1);

    const [config] = runConfigs;
    assert.ok(config && typeof config === 'object');
    const typedConfig = /** @type {{ collection?: unknown, limit?: unknown }} */ (config);
    assert.equal(typedConfig.collection, 'users');
    assert.equal(typedConfig.limit, 1);
  });
});
