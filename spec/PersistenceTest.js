const assert = require('assert');
const Tester = require('./utils/Tester.js');

const test = new Tester('test', 'users');

const sampleData = require('./assets/SampleData');

describe('Persistence of results', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should persist results into varietyResults DB', () => {
    return test.runAnalysis({collection:'users', persistResults: true}, true)
      .then(() => test.getDb('varietyResults'))
      .then((db) => db.collection('usersKeys').find().toArray())
      .then((arr) => {
        assert.equal(arr.length, 7);
        let keys = arr.map(it => it._id.key);
        assert.deepEqual(keys, ['_id', 'name', 'bio', 'birthday', 'pets', 'someBinData', 'someWeirdLegacyKey']);
      });
  });
});
