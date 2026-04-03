// @ts-check
'use strict';

import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import execute from './MongoShell.js';
import JsonValidator from './JsonValidator.js';

/**
 * @typedef {import('mongodb').Document} MongoDocument
 * @typedef {import('mongodb').MongoClient} MongoClientType
 * @typedef {import('mongodb').Collection<MongoDocument>} MongoCollection
 * @typedef {Record<string, unknown> & { outputFormat?: string }} AnalysisOptions
 * @typedef {import('./JsonValidator.js').VarietyResultRow} VarietyResultRow
 */

const mongodbPort = Number(process.env.MONGODB_PORT || 27017);
const defaultUrl = `mongodb://localhost:${mongodbPort}/test`;
const varietyPath = fileURLToPath(new URL('../../variety.js', import.meta.url));

export default class Tester {
  /** @type {MongoClientType | undefined} */
  connection;

  /** @type {MongoCollection | undefined} */
  coll;

  /**
   * @param {string} databaseName
   * @param {string} collectionName
   */
  constructor(databaseName, collectionName) {
    this.databaseName = databaseName;
    this.collectionName = collectionName;
  }

  /**
   * @returns {Promise<MongoClientType>}
   */
  async connect() {
    const connection = await MongoClient.connect(defaultUrl);
    this.connection = connection;
    this.coll = connection.db(this.databaseName).collection(this.collectionName);
    return connection;
  }

  /**
   * @param {MongoDocument[]} initialData
   * @returns {Promise<MongoClientType>}
   */
  async init(initialData) {
    const connection = await this.connect();
    if (!this.coll) {
      throw new Error('Collection connection is not available.');
    }

    await this.coll.deleteMany({});
    await this.coll.insertMany(initialData);
    return connection;
  }

  async cleanUp() {
    if (this.coll) {
      await this.coll.deleteMany({});
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  /**
   * @param {string} dbName
   */
  getDb(dbName) {
    if (!this.connection) {
      throw new Error('MongoDB connection is not available.');
    }

    return this.connection.db(dbName);
  }

  getVarietyPath() {
    return varietyPath;
  }

  /**
   * @param {AnalysisOptions} options
   * @param {boolean} [quiet=true]
   */
  async runJsonAnalysis(options, quiet) {
    const analysisOptions = { ...options, outputFormat: 'json' };
    /** @type {unknown} */
    const parsedResults = JSON.parse(await this.runAnalysis(analysisOptions, typeof quiet === 'undefined' ? true : quiet));
    if (!Array.isArray(parsedResults)) {
      throw new Error('Expected JSON analysis output to be an array.');
    }
    const typedResults = /** @type {VarietyResultRow[]} */ (parsedResults);
    return new JsonValidator(typedResults);
  }


  /**
   * @param {AnalysisOptions} [options]
   * @param {boolean} [quiet=false]
   */
  runAnalysis(options, quiet) {
    /** @type {string[]} */
    const str = [];
    if(options) {
      for (const key of Object.keys(options)) {
        const value = JSON.stringify(options[key]).replace(/"/g, '\'').replace(/\$/g, '\\$');
        str.push(`var ${key}=${value}`);
      }
    }
    return execute(this.databaseName, null, str.length > 0 ? `"${str.join(';')}"` : undefined, this.getVarietyPath(), quiet, mongodbPort);
  }
}
