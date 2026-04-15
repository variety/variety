import Tester from '../utils/Tester.js';
const test = new Tester('test', 'users');

// Two documents: one with homogeneous arrays, one with a mixed-type array.
// Alice's tags are all Strings; Bob's tags include a Number — so tags.XX
// should report {String: 2, Number: 1} when showArrayElements is enabled.
const sampleData = [
  { name: 'Alice', scores: [10, 20], tags: ['a', 'b'] },
  { name: 'Bob',   scores: [30],     tags: ['c', 1]   }
];

describe('showArrayElements option', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should suppress array-element keys by default', async () => {
    const results = await test.runJsonAnalysis({collection: 'users'}, true);
    results.validateResultsCount(4);
    results.validate('_id',    2, 100.0, {ObjectId: 2});
    results.validate('name',   2, 100.0, {String: 2});
    results.validate('scores', 2, 100.0, {Array: 2});
    results.validate('tags',   2, 100.0, {Array: 2});
    // scores.XX and tags.XX must not appear
  });

  it('should include array-element keys when showArrayElements is true', async () => {
    const results = await test.runJsonAnalysis({collection: 'users', showArrayElements: true}, true);
    results.validateResultsCount(6);
    results.validate('_id',       2, 100.0, {ObjectId: 2});
    results.validate('name',      2, 100.0, {String: 2});
    results.validate('scores',    2, 100.0, {Array: 2});
    results.validate('tags',      2, 100.0, {Array: 2});
    results.validate('scores.XX', 2, 100.0, {Number: 2});
    results.validate('tags.XX',   2, 100.0, {String: 2, Number: 1});
  });

  it('should summarize parent array types when compactArrayTypes is true', async () => {
    const results = await test.runJsonAnalysis({collection: 'users', compactArrayTypes: true}, true);
    results.validateResultsCount(4);
    results.validate('_id',    2, 100.0, {ObjectId: 2});
    results.validate('name',   2, 100.0, {String: 2});
    results.validate('scores', 2, 100.0, {'Array(Number)': 2});
    results.validate('tags',   2, 100.0, {'Array(String)': 1, 'Array(Number|String)': 1});
  });

  it('should combine compactArrayTypes with showArrayElements', async () => {
    const results = await test.runJsonAnalysis({collection: 'users', compactArrayTypes: true, showArrayElements: true}, true);
    results.validateResultsCount(6);
    results.validate('_id',       2, 100.0, {ObjectId: 2});
    results.validate('name',      2, 100.0, {String: 2});
    results.validate('scores',    2, 100.0, {'Array(Number)': 2});
    results.validate('tags',      2, 100.0, {'Array(String)': 1, 'Array(Number|String)': 1});
    results.validate('scores.XX', 2, 100.0, {Number: 2});
    results.validate('tags.XX',   2, 100.0, {String: 2, Number: 1});
  });

});

// Nested-array sample: Alice has a homogeneous matrix (all Number rows),
// Bob has a mixed matrix (one Number row, one String row).
const nestedSampleData = [
  { name: 'Alice', matrix: [[1, 2], [3, 4]] },
  { name: 'Bob',   matrix: [[5, 6], ['a', 'b']] }
];

describe('compactArrayTypes with nested arrays', () => {

  beforeEach(() => test.init(nestedSampleData));
  afterEach(() => test.cleanUp());

  it('should label nested array element types recursively', async () => {
    const results = await test.runJsonAnalysis({collection: 'users', compactArrayTypes: true}, true);
    results.validateResultsCount(3);
    results.validate('_id',    2, 100.0, {ObjectId: 2});
    results.validate('name',   2, 100.0, {String: 2});
    // Alice's matrix rows are all Number → Array(Array(Number))
    // Bob's matrix rows are Number and String → Array(Array(Number)|Array(String))
    results.validate('matrix', 2, 100.0, {'Array(Array(Number))': 1, 'Array(Array(Number)|Array(String))': 1});
  });

});
