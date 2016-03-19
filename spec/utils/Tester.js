'use strict';

const path = require('path');
const Q = require('q');
const MongoClient = require('mongodb').MongoClient;
const shell = require('./MongoShell');
const JsonValidator = require('./JsonValidator');

const mongodb_port = process.env.MONGODB_PORT || 27017;
const default_url = `mongodb://localhost:${mongodb_port}/test?autoReconnect=true`;

class Tester {
  constructor(databaseName, collectionName) {
    this.databaseName = databaseName;
    this.collectionName = collectionName;
  }

  connect() {
    return Q.nfcall(MongoClient.connect, default_url)
      .then((connection) => {
        this.connection = connection;
        this.coll = connection.db(this.databaseName).collection(this.collectionName);
        return connection;
      });
  }

  init(initialData) {
    return this.connect()
      .then(() => this.coll.deleteMany())
      .then(() => this.coll.insertMany(initialData))
      .then(() => this.connection);
  }

  cleanUp() {
    return this.coll.deleteMany()
      .then(() => this.connection.close());
  }

  getDb(dbName) {
    return Q(this.connection.db(dbName));
  }

  getVarietyPath() {
    return path.resolve(path.join(__dirname , '..', '..', 'variety.js'));
  }

  runJsonAnalysis(options) {
    options.outputFormat = 'json';
    return this.runAnalysis(options, true)
      .then(JSON.parse)
      .then(data => new JsonValidator(data));
  }


  runAnalysis(options, quiet) {
    let str = [];
    if(options) {
      for(let key in options) {
        let value = JSON.stringify(options[key]).replace(/"/g, '\'').replace(/\$/g, '\\$');
        str.push(`var ${key}=${value}`);
      }
    }
    return shell.execute(this.database, null, '"' + str.join(';') + '"', this.getVarietyPath(), quiet, mongodb_port);
  }
}

module.exports = Tester;
