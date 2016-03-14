const Tester = require('./utils/Tester.js');
const test = new Tester('test', 'users');

const sampleData = [
  {title:'Article 1', comments:[{author:'John', body:'it works', visible:true }]},
  {title:'Article 2', comments:[{author:'Tom', body:'thanks'}, {author:'Mark', body:1}]}
];

// Test, how variety handles objects, that are not named (for example objects inside array).
// It addresses behavior described in issue https://github.com/variety/variety/issues/29

describe('Unnamed object analysis', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should handle keys of unnamed object', () => {
    return test.runJsonAnalysis({collection:'users'}, true)
      .then(results => {
        results.validateResultsCount(6);
        results.validate('_id', 2, 100.0, {ObjectId: 2});
        results.validate('title', 2, 100.0, {String: 2});
        results.validate('comments', 2, 100.0, {Array: 2});

        // unnamed objects are prefixed with .XX key
        results.validate('comments.XX.author', 2, 100.0, {String: 2});
        results.validate('comments.XX.body', 2, 100.0, {String: 2, Number:1});
        results.validate('comments.XX.visible', 1, 50.0, {Boolean: 1});
      });
  });
});
