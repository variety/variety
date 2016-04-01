'use strict';

import { resolve, join } from 'path';
import { MongoClient } from 'mongodb';
import execute from './MongoShell';
import JsonValidator from './JsonValidator';

const mongodb_port = process.env.MONGODB_PORT || 27017;
const default_url = `mongodb://localhost:${mongodb_port}/test?autoReconnect=true`;

export default class Tester {
  constructor(databaseName, collectionName) {
    this.databaseName = databaseName;
    this.collectionName = collectionName;
  }

  async connect() {
    const connection = await MongoClient.connect(default_url);
    this.connection = connection;
    this.coll = connection.db(this.databaseName).collection(this.collectionName);
    return connection;
  }

  async init(initialData) {
    var connection = await this.connect();
    await this.coll.deleteMany();
    await this.coll.insertMany(initialData);
    return connection;
  }

  async cleanUp() {
    await this.coll.deleteMany();
    await this.connection.close();
  }

  getDb(dbName) {
    return this.connection.db(dbName);
  }

  getVarietyPath() {
    return resolve(join(__dirname , '..', '..', 'variety.js'));
  }

  async runJsonAnalysis(options) {
    options.outputFormat = 'json';
    const result = await this.runAnalysis(options, true);
    return new JsonValidator(JSON.parse(result));
  }


  runAnalysis(options, quiet) {
    let str = [];
    if(options) {
      for(let key in options) {
        let value = JSON.stringify(options[key]).replace(/"/g, '\'').replace(/\$/g, '\\$');
        str.push(`var ${key}=${value}`);
      }
    }
    return execute(this.database, null, '"' + str.join(';') + '"', this.getVarietyPath(), quiet, mongodb_port);
  }
}
