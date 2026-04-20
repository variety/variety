// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
import assert from 'assert';
import execute from '../../helpers/MongoShellRunner.js';
import VarietyHarness from '../../helpers/VarietyHarness.js';
import sampleData from '../../fixtures/seed-data.js';

const test = new VarietyHarness('test', 'users');
const mongodbPort = Number(process.env['MONGODB_PORT'] || 27017);

/**
 * @typedef {{
 *   collection?: unknown,
 *   query?: unknown,
 *   limit?: unknown,
 *   maxDepth?: unknown,
 *   sort?: unknown,
 *   outputFormat?: unknown,
 *   persistResults?: unknown,
 *   resultsDatabase?: unknown,
 *   resultsCollection?: unknown,
 *   resultsUser?: unknown,
 *   resultsPass?: unknown,
 *   showArrayElements?: unknown,
 *   compactArrayTypes?: unknown,
 *   plugins?: unknown,
 * }} ParsedParams
 */

/**
 * @param {ParsedParams} params
 * @param {string} key
 * @param {unknown} parsedValue
 * @returns {ParsedParams}
 */
const setParsedParam = (params, key, parsedValue) => {
  switch (key) {
  case 'collection':
  case 'query':
  case 'limit':
  case 'maxDepth':
  case 'sort':
  case 'outputFormat':
  case 'persistResults':
  case 'resultsDatabase':
  case 'resultsCollection':
  case 'resultsUser':
  case 'resultsPass':
  case 'showArrayElements':
  case 'compactArrayTypes':
  case 'plugins':
    params[key] = parsedValue;
    break;
  default:
    break;
  }

  return params;
};

/**
 * @param {string} output
 * @returns {ParsedParams}
 */
const parseParams = (output) => {
  return output
    .split('\n') // split by new line
    .filter((line) => line.startsWith('Using')) // take only lines starting with Using
    .map((line) => /^Using\s(\S+)\sof\s(.*)$/.exec(line)) // parse with regular expression
    .filter((match) => match !== null) // filter out non-matching lines
    .reduce((acc, match) => {
      const key = match[1];
      const rawValue = match[2];
      if (typeof key === 'undefined' || typeof rawValue === 'undefined') {
        return acc;
      }
      const parsedValue = /** @type {unknown} */ (JSON.parse(rawValue));
      return setParsedParam(acc, key, parsedValue);
    }, /** @type {ParsedParams} */ ({})); // reduce to params object
};

describe('Parameters parsing', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should parse default params', async () => {
    const results = await test.runAnalysis({collection:'users'});
    const params = parseParams(results);
    assert.equal(params.collection, 'users');
    assert.deepEqual(params.query, {});
    assert.equal(params.limit, 5);
    assert.equal(params.maxDepth, 99);
    assert.deepEqual(params.sort, {'_id':-1});
    assert.equal(params.outputFormat, 'ascii');
    assert.equal(params.persistResults, false);
    assert.equal(params.resultsDatabase, 'varietyResults');
    assert.equal(params.resultsCollection, 'usersKeys');
    assert.equal(params.resultsUser, null);
    assert.equal(params.resultsPass, null);
    assert.equal(params.showArrayElements, false);
    assert.equal(params.compactArrayTypes, false);
    assert.deepEqual(params.plugins, []);
  });

  it('should parse restricted results', async () => {

    const criteria = {
      collection:'users',
      query: {name:'Harry'},
      sort: {name:1},
      maxDepth: 5,
      limit: 2
    };

    const results = await test.runAnalysis(criteria);
    const params = parseParams(results);
    assert.equal(params.limit, 2);
    assert.equal(params.maxDepth, 5);
    assert.deepEqual(params.sort, {name:1});
    assert.deepEqual(params.query, {name:'Harry'});
  });

  it('should recognize unknown collection', async () => {
    const unknownCollection = '--unknown--';
    try {
      await test.runAnalysis({collection: unknownCollection});
      assert.fail(`Expected runAnalysis to throw an error for unknown collection "${unknownCollection}"`);
    } catch(err) {
      const error = /** @type {NodeJS.ErrnoException & { stdout?: string }} */ (err);
      assert.ok(typeof error.code === 'number' && error.code > 0);
      assert.ok(typeof error.stdout === 'string' && error.stdout.includes('The collection specified (--unknown--) in the database specified (test) does not exist or is empty.'));
    }
  });

  it('should return empty object when there are no Using lines', () => {
    const output = [
      'Some unrelated log line',
      'Another line without the keyword'
    ].join('\n');

    const params = parseParams(output);
    assert.deepEqual(params, {});
  });

  it('should ignore non-matching Using lines and parse matching ones', () => {
    const output = [
      'Using collection users', // missing "of" and JSON part, will not match regex
      'Using collection of {"name":"Alice"}'
    ].join('\n');

    const params = parseParams(output);
    assert.deepEqual(params.collection, { name: 'Alice' });
    assert.strictEqual(Object.keys(params).length, 1);
  });

  it('should throw when Using line contains invalid JSON', () => {
    const output = 'Using collection of {invalidJson}';

    assert.throws(
      () => {
        parseParams(output);
      },
      SyntaxError
    );
  });

  it('should log BSON values as parseable JSON when tojson is unavailable', async () => {
    if (!test.coll) {
      throw new Error('Collection connection is not available.');
    }
    /** @type {{ _id: import('mongodb').ObjectId } | null} */
    const doc = await test.coll.findOne({name: 'Tom'});
    if (!doc) {
      throw new Error('Expected Tom document to exist.');
    }
    const output = await execute(
      'test',
      null,
      `"var collection='users'; var tojson=undefined; var query={_id:ObjectId('${doc._id.toHexString()}')}"`,
      test.getVarietyPath(),
      false,
      mongodbPort
    );

    const params = parseParams(output);
    assert.deepEqual(params.query, {
      _id: { $oid: doc._id.toHexString() }
    });
  });

});
