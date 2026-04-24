// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// INTERFACE SECTION
// =============================================================================
(function (shellContext) {
  'use strict'; // wraps everything for which we can use strict mode ―JC

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const configApi = shellContext.__varietyConfig ||
    (typeof module !== 'undefined' && module && module.exports && typeof require === 'function'
      ? require('../core/config.js')
      : undefined);
  if (!configApi) {
    throw new Error('Expected core/config.js to register __varietyConfig.');
  }

  const impl = shellContext.__varietyImpl;
  const {
    ANALYSIS_OPTION_NAMES,
    materializeAnalysisConfig,
    resolveAnalysisOptions,
  } = configApi;

  const shellIsQuiet = (context) => {
    if (typeof context.__quiet !== 'undefined' && context.__quiet) {
      return true;
    }

    return typeof context.process !== 'undefined' &&
      context.process &&
      context.process.argv &&
      context.process.argv.includes('--quiet');
  };

  const createLogger = (context) => {
    return (message) => {
      if (!shellIsQuiet(context)) {
        context.print(message);
      }
    };
  };

  const createCountMatchingDocuments = (context) => {
    return (collectionName, query, limit) => {
      const coll = context.db.getCollection(collectionName);
      const options = (typeof limit === 'number' && limit > 0) ? {limit} : undefined;
      return coll.countDocuments(query, options);
    };
  };

  const logBanner = (log) => {
    log('Variety: A MongoDB Schema Analyzer');
    log('Version 1.5.2, released 30 September 2025');
  };

  const applySecondaryReadPreference = (context) => {
    if (typeof context.secondaryOk !== 'undefined') {
      if (context.secondaryOk === true) {
        context.db.getMongo().setReadPref('secondary');
      }
    }
  };

  const validateShellStartup = (context, countMatchingDocuments) => {
    const selectedDatabaseName = context.db.getName();
    const knownDatabases = context.db.adminCommand('listDatabases').databases;
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

    const collectionNames = context.db.getCollectionNames();
    const collNames = collectionNames.join(', ');
    if (collectionNames.length === 0) {
      throw new Error(`The database specified (${selectedDatabaseName}) is empty.\n` +
          `Possible database options are: ${knownDatabaseNames.join(', ')}.`);
    }

    const collectionName = context.collection;
    if (typeof collectionName === 'undefined') {
      throw new Error('You have to supply a \'collection\' variable, à la --eval \'var collection = "animals"\'.\n' +
          `Possible collection options for database specified: ${collNames}.\n` +
          'Please see https://github.com/variety/variety for details.');
    }

    if (countMatchingDocuments(collectionName, {}) === 0) {
      throw new Error(`The collection specified (${collectionName}) in the database specified (${context.db.getName()}) does not exist or is empty.\n` +
          `Possible collection options for database specified: ${collNames}.`);
    }

    return { collectionName };
  };

  const resolveShellConfig = (context, collectionName, countMatchingDocuments, log) => {
    const resolvedOptions = resolveAnalysisOptions(context, {
      collectionName,
      getDefaultLimit(query) {
        return countMatchingDocuments(collectionName, query);
      },
    });

    log(`Using collection of ${impl.shellToJson(collectionName)}`);
    ANALYSIS_OPTION_NAMES.forEach((name) => {
      log(`Using ${name} of ${impl.shellToJson(resolvedOptions[name])}`);
    });

    return Object.assign({ collection: collectionName }, materializeAnalysisConfig(resolvedOptions));
  };

  const createPluginsRunner = (context, log) => {
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
          context.load(path);
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

  const prepareShellExecution = (context) => {
    const log = createLogger(context);
    const countMatchingDocuments = createCountMatchingDocuments(context);

    logBanner(log);
    applySecondaryReadPreference(context);

    const { collectionName } = validateShellStartup(context, countMatchingDocuments);
    const config = resolveShellConfig(context, collectionName, countMatchingDocuments, log);
    const pluginsRunner = createPluginsRunner(context, log);
    pluginsRunner.execute('onConfig', config);

    return {
      config,
      deps: {
        db: context.db,
        connect: typeof context.connect !== 'undefined' ? context.connect : undefined,
        log,
        print: context.print,
        countMatchingDocuments,
      },
      pluginsRunner,
    };
  };

  const executePreparedShellExecution = (preparedExecution) => {
    impl.run(preparedExecution.config, preparedExecution.pluginsRunner, preparedExecution.deps);
  };

  const preparedExecution = prepareShellExecution(shellContext);
  executePreparedShellExecution(preparedExecution);

  // Clean up the implementation handoffs so repeated loads remain idempotent
  // and no ad hoc internals leak onto globalThis after execution.
  delete shellContext.__varietyConfig;
  delete shellContext.__varietyEngine;
  delete shellContext.__varietyImpl;
  delete shellContext.__varietyFormatters;
}(this)); // end strict mode
