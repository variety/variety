const Tester = require('./utils/Tester.js');
const test = new Tester('test', 'users');

const sampleData = require('./assets/SampleData');

describe('Query-limited analysis', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should return only filtered values', () => {
    return test.runJsonAnalysis({collection:'users', query:{birthday:{$exists: true}}}).then(results => {
      results.validateResultsCount(5);
      results.validate('_id', 2, 100.0, {ObjectId: 2});
      results.validate('birthday', 2, 100.0, {Date: 2});
      results.validate('name', 2, 100.0, {String: 2});
      results.validate('bio', 1, 50.0, {String: 1});
      results.validate('pets', 1, 50.0, {String: 1});
    });
  });
});
