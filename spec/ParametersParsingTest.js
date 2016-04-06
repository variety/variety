import assert from 'assert';
import Tester from './utils/Tester.js';
import sampleData from './assets/SampleData';

const test = new Tester('test', 'users');

const parseParams = (output) => {
  return output
    .split('\n') // split by new line
    .filter(line => line.indexOf('Using') === 0) // take only lines starting with Using
    .map(line => /^Using\s{1}(\w+)\s{1}of\s{1}(.*)$/.exec(line)) // parse with regular expression
    .reduce((acc, match) => {acc[match[1]] = JSON.parse(match[2]); return acc;}, {}); // reduce to params object
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

  it('should recognize unknown collection', async (done) => {
    try {
      await test.runAnalysis({collection:'--unknown--'});
      done(new Error('Should throw an exception!'));
    } catch(err) {
      assert.ok(err.code > 0);
      assert.ok(err.stdout.indexOf('The collection specified (--unknown--) in the database specified (test) does not exist or is empty.') > -1);
      done();
    }
  });

});
