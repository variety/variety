import Tester from './utils/Tester.js';
import sampleData from './assets/SampleData';
const test = new Tester('test', 'users');

describe('Query-limited analysis', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should return only filtered values', async () => {
    const results = await test.runJsonAnalysis({collection:'users', query:{birthday:{$exists: true}}});
    results.validateResultsCount(5);
    results.validate('_id', 2, 100.0, {ObjectId: 2});
    results.validate('birthday', 2, 100.0, {Date: 2});
    results.validate('name', 2, 100.0, {String: 2});
    results.validate('bio', 1, 50.0, {String: 1});
    results.validate('pets', 1, 50.0, {String: 1});
  });
});
