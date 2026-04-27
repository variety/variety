// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
// =============================================================================
// ANALYZER SECTION
// =============================================================================
(function (shellContext) {
  'use strict';

  shellContext = typeof globalThis !== 'undefined' ? globalThis : shellContext;

  const engine = shellContext.__varietyEngine ||
    (typeof module !== 'undefined' && module && module.exports && typeof require === 'function'
      ? require('./engine.js')
      : undefined);
  if (!engine) {
    throw new Error('Expected core/engine.js to register __varietyEngine.');
  }

  const shellToJson = (value) => {
    if (typeof tojson === 'function') {
      return tojson(value);
    }

    if (shellContext.EJSON && typeof shellContext.EJSON.stringify === 'function') {
      return shellContext.EJSON.stringify(value);
    }

    return JSON.stringify(value);
  };

  const persistResults = (config, varietyResults, deps) => {
    const {db, connect, log} = deps;

    const resultsCollectionName = config.resultsCollection;
    const resultsDB = !config.resultsDatabase.includes('/')
      // Local database; don't reconnect.
      ? db.getMongo().getDB(config.resultsDatabase)
      // Remote database, establish new connection.
      : connect(config.resultsDatabase);

    if (config.resultsUser !== null && config.resultsPass !== null) {
      resultsDB.auth(config.resultsUser, config.resultsPass);
    }

    // Replace results collection.
    log(`replacing results collection: ${resultsCollectionName}`);
    resultsDB.getCollection(resultsCollectionName).drop();
    resultsDB.getCollection(resultsCollectionName).insert(varietyResults);
  };

  const formatResults = (config, pluginsRunner, varietyResults, print) => {
    const formatterFactory = shellContext.__varietyFormatters[config.outputFormat];
    if (typeof formatterFactory !== 'function') {
      throw new Error(`Unknown outputFormat "${config.outputFormat}". Valid values are: ${Object.keys(shellContext.__varietyFormatters).join(', ')}.`);
    }
    const builtInFormatter = formatterFactory(config);

    const pluginsOutput = pluginsRunner.execute('formatResults', varietyResults);
    const outputs = pluginsOutput.length > 0 ? pluginsOutput : [builtInFormatter.formatResults(varietyResults)];
    outputs.forEach((output) => print(output));
  };

  // Orchestrates a Variety analysis from a parsed config and constructed
  // pluginsRunner, pulling every shell primitive it needs from `deps`.
  const run = (config, pluginsRunner, deps) => {
    const {db, connect, log, print, countMatchingDocuments} = deps;

    // limit(0) meant "no limit" in MongoDB ≤7 but is rejected by MongoDB 8+; guard against it.
    let cursor = db.getCollection(config.collection).find(config.query).sort(config.sort);
    if (config.limit > 0) { cursor = cursor.limit(config.limit); }
    const interimResults = engine.createAnalysisState();
    cursor.forEach((obj) => {
      // This shell-backed cursor already reflects mongosh/mongo BSON promotion,
      // so Double and Int32 arrive here as plain JavaScript numbers.
      engine.ingestDocument(config, interimResults, obj, log);
    });
    const varietyResults = engine.finalizeResults(
      config,
      interimResults,
      countMatchingDocuments(config.collection, config.query, config.limit)
    );

    if (config.persistResults) {
      persistResults(config, varietyResults, {db, connect, log});
    }

    formatResults(config, pluginsRunner, varietyResults, print);
  };

  const impl = Object.assign({}, engine, { run, shellToJson });
  shellContext.__varietyImpl = impl;

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = impl;
  }
}(this));
