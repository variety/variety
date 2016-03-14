const assert = require('assert');
const Tester = require('./utils/Tester.js');
const test = new Tester('test', 'users');

const sampleData = require('./assets/SampleData');
const expectedAscii = require('./assets/ExpectedAscii');

describe('Basic Analysis', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should return ASCII results', () => {
    return test.runAnalysis({collection:'users'}, true).then(output => {
      assert.equal(output, expectedAscii);
    });
  });

  it('should return JSON results', () => {
    return test.runJsonAnalysis({collection:'users'}, true)
      .then(results => {

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
});
