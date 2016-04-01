import Tester from './utils/Tester.js';
import sampleData from './assets/SampleData';

const test = new Tester('test', 'users');

describe('Sorted-data analysis', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should not exclude any results', async () => {
    const results = await test.runJsonAnalysis({collection:'users', sort:{name:-1}});
    results.validateResultsCount(7);
    results.validate('_id', 5, 100.0, {ObjectId: 5});
    results.validate('name', 5, 100.0, {String: 5});
    results.validate('bio', 3, 60.0, {String: 3});
    results.validate('birthday', 2,  40.0, {Date: 2});
    results.validate('pets', 2,  40.0, {String: 1, Array: 1});
    results.validate('someBinData', 1,  20.0, {'BinData-generic': 1});
    results.validate('someWeirdLegacyKey', 1,  20.0, {String: 1});
  });

  it('should sort and apply limit', async () => {
    const criteria = {
      collection:'users',
      sort:{name:-1},
      limit:1
    };

    // when sorting default SampleData by name desc, first entry becomes Tom. He is only with key 'someWeirdLegacyKey'
    // Together with applying limit 1, Tom is the only result in analysis. That gives us chance to assume keys and verify
    // that ordering is correct.
    // {name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someWeirdLegacyKey: "I like Ike!"}
    const results = await test.runJsonAnalysis(criteria);
    results.validateResultsCount(5);
    results.validate('_id', 1, 100.0, {ObjectId: 1});
    results.validate('name', 1, 100.0, {String: 1});
    results.validate('bio', 1, 100.0, {String: 1});
    results.validate('pets', 1, 100.0, {Array: 1});
    results.validate('someWeirdLegacyKey', 1, 100.0, {String: 1});
  });
});
