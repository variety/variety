import assert from 'assert';
import Tester from './utils/Tester.js';
import sampleData from './assets/SampleData.js';

const test = new Tester('test', 'users');

const parseParams = (output) => {
  return output
    .split('\n') // split by new line
    .filter(line => line.startsWith('Using')) // take only lines starting with Using
    .map(line => /^Using\s(\S+)\sof\s(.*)$/.exec(line)) // parse with regular expression
    .filter(match => match) // filter out non-matching lines
    .reduce((acc, match) => ({ ...acc, [match[1]]: JSON.parse(match[2]) }), {}); // reduce to params object
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
      assert.ok(err.code > 0);
      assert.ok(err.stdout.includes('The collection specified (--unknown--) in the database specified (test) does not exist or is empty.'));
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

});
