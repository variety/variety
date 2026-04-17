// SPDX-License-Identifier: MIT
// =============================================================================
// INTERFACE SECTION
// =============================================================================
(function (shellContext) {
  'use strict'; // wraps everything for which we can use strict mode ―JC

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const impl = shellContext.__varietyImpl;

  const shellIsQuiet = () => {
    if (typeof __quiet !== 'undefined' && __quiet) {
      return true;
    }

    return typeof process !== 'undefined' &&
      process &&
      process.argv &&
      process.argv.includes('--quiet');
  };

  const log = (message) => {
    if (!shellIsQuiet()) {
      print(message);
    }
  };

  const countMatchingDocuments = (collectionName, query, limit) => {
    const coll = db.getCollection(collectionName);
    const options = (typeof limit === 'number' && limit > 0) ? {limit} : undefined;
    return coll.countDocuments(query, options);
  };

  log('Variety: A MongoDB Schema Analyzer');
  log('Version 1.5.2, released 30 September 2025');

  if (typeof slaveOk !== 'undefined') {
    if (slaveOk === true) {
      db.getMongo().setSlaveOk();
    }
  }

  const selectedDatabaseName = db.getName();
  const knownDatabases = db.adminCommand('listDatabases').databases;
  const knownDatabaseNames = [];
  if (typeof knownDatabases !== 'undefined') { // not authorized user receives error response (json) without databases key
    // Keep validation scoped to the selected database. Issue #145
    // (@pkgajulapalli) hit a startup failure while enumerating collections for
    // an unrelated database.
    knownDatabases.forEach((database) => {
      if (typeof database.name === 'string' && database.name.length > 0) {
        knownDatabaseNames.push(database.name);
      }
    });

    if (!knownDatabaseNames.includes(selectedDatabaseName)) {
      throw new Error(`The database specified (${selectedDatabaseName}) does not exist.\n` +
          `Possible database options are: ${knownDatabaseNames.join(', ')}.`);
    }
  }

  const collectionNames = db.getCollectionNames();
  const collNames = collectionNames.join(', ');
  if (collectionNames.length === 0) {
    throw new Error(`The database specified (${selectedDatabaseName}) is empty.\n` +
        `Possible database options are: ${knownDatabaseNames.join(', ')}.`);
  }

  if (typeof collection === 'undefined') {
    throw new Error('You have to supply a \'collection\' variable, à la --eval \'var collection = "animals"\'.\n' +
        `Possible collection options for database specified: ${collNames}.\n` +
        'Please see https://github.com/variety/variety for details.');
  }

  if (countMatchingDocuments(collection, {}) === 0) {
    throw new Error(`The collection specified (${collection}) in the database specified (${db.getName()}) does not exist or is empty.\n` +
        `Possible collection options for database specified: ${collNames}.`);
  }

  const readConfig = (configProvider) => {
    const config = {};
    const read = (name, defaultValue) => {
      const value = typeof configProvider[name] !== 'undefined' ? configProvider[name] : defaultValue;
      config[name] = value;
      log(`Using ${name} of ${impl.shellToJson(value)}`);
    };
    read('collection', null);
    read('query', {});
    read('limit', countMatchingDocuments(config.collection, config.query));
    read('maxDepth', 99);
    read('sort', {_id: -1});
    read('outputFormat', 'ascii');
    read('persistResults', false);
    read('resultsDatabase', 'varietyResults');
    read('resultsCollection', `${collection}Keys`);
    read('resultsUser', null);
    read('resultsPass', null);
    read('logKeysContinuously', false);
    read('excludeSubkeys', []);
    read('arrayEscape', 'XX');
    read('showArrayElements', false);
    read('compactArrayTypes', false);
    read('lastValue', false);

    // Translate excludeSubkeys into a set-like object for compatibility.
    config.excludeSubkeys = config.excludeSubkeys.reduce((result, item) => {
      result[`${item}.`] = true;
      return result;
    }, impl.createKeyMap());

    return config;
  };

  const config = readConfig(shellContext);

  const createPluginsRunner = (context) => {
    const parsePath = (val) => val.slice(-3) !== '.js' ? `${val}.js` : val;
    const parseConfig = (val) => {
      const cfg = {};
      val.split('&').reduce((acc, entry) => {
        const parts = entry.split('=');
        acc[parts[0]] = parts[1];
        return acc;
      }, cfg);
      return cfg;
    };

    const plugins = typeof context.plugins !== 'undefined'
      ? context.plugins.split(',')
        .map((p) => p.trim())
        .map((definition) => {
          const path = parsePath(definition.split('|')[0]);
          const cfg = parseConfig(definition.split('|')[1] || '');
          context.module = {exports: {}};
          load(path);
          const plugin = context.module.exports;
          delete context.module;
          plugin.path = path;
          if (typeof plugin.init === 'function') {
            plugin.init(cfg);
          }
          return plugin;
        })
      : [];

    log(`Using plugins of ${impl.shellToJson(plugins.map((plugin) => plugin.path))}`);

    return {
      execute(methodName, ...args) {
        const applicablePlugins = plugins.filter((plugin) => typeof plugin[methodName] === 'function');
        return applicablePlugins.map((plugin) => plugin[methodName](...args));
      }
    };
  };

  const pluginsRunner = createPluginsRunner(shellContext);
  pluginsRunner.execute('onConfig', config);

  impl.run(config, pluginsRunner, {
    db,
    connect: typeof connect !== 'undefined' ? connect : undefined,
    log,
    print,
    countMatchingDocuments,
  });

  // Clean up the implementation handoffs so repeated loads remain idempotent
  // and no ad hoc internals leak onto globalThis after execution.
  delete shellContext.__varietyImpl;
  delete shellContext.__varietyFormatters;
}(this)); // end strict mode
