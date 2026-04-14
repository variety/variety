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

  const shellPrintJson = (value) => {
    print(JSON.stringify(value, null, 2));
  };

  const getDatabase = (name) => {
    if (typeof db.getSisterDB === 'function') {
      return db.getSisterDB(name);
    }

    return db.getMongo().getDB(name);
  };

  const countMatchingDocuments = (collectionName, query, limit) => {
    const coll = db.getCollection(collectionName);
    const options = (typeof limit === 'number' && limit > 0) ? {limit} : undefined;
    return coll.countDocuments(query, options);
  };

  log('Variety: A MongoDB Schema Analyzer');
  log('Version 1.5.2, released 30 September 2025');

  const dbs = [];
  const emptyDbs = [];

  if (typeof slaveOk !== 'undefined') {
    if (slaveOk === true) {
      db.getMongo().setSlaveOk();
    }
  }

  const knownDatabases = db.adminCommand('listDatabases').databases;
  if (typeof knownDatabases !== 'undefined') { // not authorized user receives error response (json) without databases key
    knownDatabases.forEach((d) => {
      const collectionNames = getDatabase(d.name).getCollectionNames();
      if (collectionNames.length > 0) {
        dbs.push(d.name);
      } else {
        emptyDbs.push(d.name);
      }
    });

    if (emptyDbs.includes(db.getName())) {
      throw new Error(`The database specified (${db.getName()}) is empty.\n` +
          `Possible database options are: ${dbs.join(', ')}.`);
    }

    if (!dbs.includes(db.getName())) {
      throw new Error(`The database specified (${db.getName()}) does not exist.\n` +
          `Possible database options are: ${dbs.join(', ')}.`);
    }
  }

  const collNames = db.getCollectionNames().join(', ');
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
    shellPrintJson,
    countMatchingDocuments,
  });

  // Clean up the implementation handoff so repeated loads remain idempotent
  // and no ad hoc internals leak onto globalThis after execution.
  delete shellContext.__varietyImpl;
}(this)); // end strict mode
