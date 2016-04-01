import Tester from './utils/Tester.js';
import sampleData from './assets/SampleData';

const test = new Tester('test', 'users');

describe('Limited results count analysis', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should analyze only first item', async () => {
    // limit=1 without other params selects the last inserted document (see sampleData)
    // it should equals {name: "Jim", someBinData: new BinData(2,"1234")}
    const results = await test.runJsonAnalysis({collection:'users', limit:1});
    results.validate('_id', 1, 100.0, {ObjectId:1});
    results.validate('name', 1, 100.0, {String:1});
    results.validate('someBinData', 1, 100.0, {'BinData-generic':1});
  });

  it('should analyze all and compute real percentages', async () => {
    const results = await test.runJsonAnalysis({collection:'users', limit:10});
      // limit is set to higher number, that the actual number of documents in collection
      // analysis should compute percentages based on the real number of documents, not on the
      // number provided in the limit var.
    results.validateResultsCount(7);
    results.validate('_id', 5, 100.0, {ObjectId: 5});
    results.validate('name', 5, 100.0, {String: 5});
    results.validate('bio', 3, 60.0, {String: 3});
    results.validate('birthday', 2,  40.0, {Date: 2});
    results.validate('pets', 2,  40.0, {String: 1, Array: 1});
    results.validate('someBinData', 1,  20.0, {'BinData-generic': 1});
    results.validate('someWeirdLegacyKey', 1,  20.0, {String: 1});
  });
});
