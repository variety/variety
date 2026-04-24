// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import fs from 'fs';
import { createRequire } from 'module';
import vm from 'vm';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const adapterPath = fileURLToPath(new URL('../../../mongo-shell/adapter.js', import.meta.url));
const adapterSource = fs.readFileSync(adapterPath, 'utf8');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const configModule = /** @type {typeof import('../../../core/config.js')} */ (require('../../../core/config.js'));

/**
 * @typedef {{ countDocuments(query: Record<string, unknown>, options?: { limit: number }): number }} FakeCollection
 * @typedef {{ name: string }} FakeDatabaseInfo
 * @typedef {{ databases?: FakeDatabaseInfo[] }} FakeListDatabasesResult
 * @typedef {{
 *   countMatchingDocuments(collectionName: string, query: Record<string, unknown>, limit?: number): number,
 *   db: FakeDb,
 *   log(message: string): void,
 *   print(message?: string): void,
 * }} FakeRunDeps
 * @typedef {{ execute(methodName: string, ...args: unknown[]): unknown[] }} FakePluginsRunner
 * @typedef {{
 *   formatResults(results: unknown[]): string,
 *   init(pluginConfig: Record<string, string>): void,
 *   onConfig(config: { collection: string }): void,
 *   path?: string,
 * }} FakeLoadedPlugin
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
      __varietyConfig: configModule,
      __varietyImpl: {
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

  it('runs plugin lifecycle hooks during preparation before invoking the analyzer', () => {
    /** @type {string[]} */
    const events = [];
    /** @type {string[]} */
    const sisterDbCalls = [];

    /** @type {{
     *   __varietyConfig: typeof import('../../../core/config.js'),
     *   __varietyEngine: { marker: string },
     *   __varietyFormatters: { ascii: { marker: string } },
     *   __varietyImpl: {
     *     run(config: { collection: string }, pluginsRunner: FakePluginsRunner, deps: FakeRunDeps): void,
     *     shellToJson: typeof JSON.stringify,
     *   },
     *   collection: string,
     *   db: FakeDb,
     *   load(path: string): void,
     *   module?: { exports: FakeLoadedPlugin },
     *   plugins: string,
     *   print(message?: string): void,
     * }} */
    const context = {
      __varietyConfig: configModule,
      __varietyEngine: { marker: 'engine' },
      __varietyFormatters: { ascii: { marker: 'formatter' } },
      __varietyImpl: {
        run(config, pluginsRunner, deps) {
          events.push('run');
          assert.equal(config.collection, 'users');
          assert.equal(typeof deps.countMatchingDocuments, 'function');
          assert.equal(typeof deps.log, 'function');
          assert.equal(deps.db, context.db);
          assert.equal(typeof deps.print, 'function');
          assert.deepEqual(
            pluginsRunner.execute('formatResults', [{ _id: { key: 'users.name' } }]),
            ['formatted output']
          );
        },
        shellToJson: JSON.stringify,
      },
      collection: 'users',
      db: createDb(sisterDbCalls),
      /**
       * @param {string} path
      */
      load(path) {
        events.push(`load:${path}`);
        if (!context.module) {
          throw new Error('Expected the adapter to install a CommonJS module shim before load().');
        }
        context.module.exports = {
          formatResults() {
            events.push('formatResults');
            return 'formatted output';
          },
          init(pluginConfig) {
            events.push(`init:${JSON.stringify(pluginConfig)}`);
          },
          onConfig(config) {
            events.push(`onConfig:${config.collection}`);
          },
        };
      },
      plugins: 'test-plugin|delimiter=;&mode=full',
      print: () => {},
    };

    vm.createContext(context);
    vm.runInContext(adapterSource, context, { filename: adapterPath });

    assert.deepEqual(sisterDbCalls, []);
    assert.deepEqual(events, [
      'load:test-plugin.js',
      'init:{"delimiter":";","mode":"full"}',
      'onConfig:users',
      'run',
      'formatResults',
    ]);
  });

  it('does not enumerate collections for unrelated databases during startup', () => {
    /** @type {unknown[]} */
    const runConfigs = [];
    /** @type {string[]} */
    const sisterDbCalls = [];
    /**
     * @param {unknown} config
     */
    const captureRunConfig = (config) => {
      runConfigs.push(config);
    };

    const context = {
      __varietyConfig: configModule,
      __varietyImpl: {
        run: captureRunConfig,
        shellToJson: JSON.stringify,
      },
      collection: 'users',
      db: createDb(sisterDbCalls),
      excludeSubkeys: ['meta.tags'],
      print: () => {},
    };

    vm.createContext(context);
    vm.runInContext(adapterSource, context, { filename: adapterPath });

    assert.deepEqual(sisterDbCalls, []);
    assert.equal(runConfigs.length, 1);

    const [config] = runConfigs;
    assert.ok(config && typeof config === 'object');
    const typedConfig = /** @type {{ collection?: unknown, limit?: unknown, excludeSubkeys?: unknown, resultsCollection?: unknown }} */ (config);
    assert.equal(typedConfig.collection, 'users');
    assert.equal(typedConfig.limit, 1);
    assert.deepEqual(typedConfig.excludeSubkeys, { 'meta.tags.': true });
    assert.equal(typedConfig.resultsCollection, 'usersKeys');
  });

  it('cleans up shell handoff globals after successful execution', () => {
    /** @type {string[]} */
    const sisterDbCalls = [];

    const context = {
      __varietyConfig: configModule,
      __varietyEngine: { marker: 'engine' },
      __varietyFormatters: { ascii: { marker: 'formatter' } },
      __varietyImpl: {
        run() {},
        shellToJson: JSON.stringify,
      },
      collection: 'users',
      db: createDb(sisterDbCalls),
      print: () => {},
    };

    vm.createContext(context);
    vm.runInContext(adapterSource, context, { filename: adapterPath });

    assert.deepEqual(sisterDbCalls, []);
    assert.equal(Object.hasOwn(context, '__varietyConfig'), false);
    assert.equal(Object.hasOwn(context, '__varietyEngine'), false);
    assert.equal(Object.hasOwn(context, '__varietyImpl'), false);
    assert.equal(Object.hasOwn(context, '__varietyFormatters'), false);
  });
});
