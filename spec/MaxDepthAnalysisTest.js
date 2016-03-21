const Tester = require('./utils/Tester.js');
const test = new Tester('test', 'users');

describe('Max-depth-limited analysis', () => {

  beforeEach(() => test.init([{name:'Walter', someNestedObject:{a:{b:{c:{d:{e:1}}}}}}]));
  afterEach(() => test.cleanUp());

  it('should return all keys', () => {
    return test.runJsonAnalysis({collection:'users'}).then(results => {

      results.validateResultsCount(8);

      results.validate('_id', 1, 100.0, {ObjectId:1});
      results.validate('name', 1, 100.0, {String:1});
      results.validate('someNestedObject', 1, 100.0, {Object:1});
      results.validate('someNestedObject.a', 1, 100.0, {Object:1});
      results.validate('someNestedObject.a.b', 1, 100.0, {Object:1});
      results.validate('someNestedObject.a.b.c', 1, 100.0, {Object:1});
      results.validate('someNestedObject.a.b.c.d', 1, 100.0, {Object:1});
      results.validate('someNestedObject.a.b.c.d.e', 1, 100.0, {Number:1});
    });
  });

  it('should return only first 3 levels', () => {
    return test.runJsonAnalysis({collection:'users', maxDepth:3}).then(results => {

      results.validateResultsCount(5);

      results.validate('_id', 1, 100.0, {ObjectId:1});
      results.validate('name', 1, 100.0, {String:1});
      results.validate('someNestedObject', 1, 100.0, {Object:1});
      results.validate('someNestedObject.a', 1, 100.0, {Object:1});
      results.validate('someNestedObject.a.b', 1, 100.0, {Object:1});
    });
  });
});
