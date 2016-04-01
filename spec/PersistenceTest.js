import assert from 'assert';
import Tester from './utils/Tester.js';
import sampleData from './assets/SampleData';

const test = new Tester('test', 'users');

describe('Persistence of results', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should persist results into varietyResults DB', async () => {
    await test.runAnalysis({collection:'users', persistResults: true}, true);
    const db = await test.getDb('varietyResults');
    const arr = await db.collection('usersKeys').find().toArray();
    assert.equal(arr.length, 7);
    const keys = arr.map(it => it._id.key);
    assert.deepEqual(keys, ['_id', 'name', 'bio', 'birthday', 'pets', 'someBinData', 'someWeirdLegacyKey']);
  });
});
