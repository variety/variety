import assert from 'assert';
import Tester from './utils/Tester.js';
import sampleData from './assets/SampleData';

const test = new Tester('test', 'users');

const pattern = /^Found new key type "(.{1,})" type "(.{1,})"$/g;
const expectedLines = [
  'Found new key type "_id" type "ObjectId"',
  'Found new key type "name" type "String"',
  'Found new key type "someBinData" type "BinData-generic"',
  'Found new key type "bio" type "String"',
  'Found new key type "pets" type "String"',
  'Found new key type "birthday" type "Date"',
  'Found new key type "pets" type "Array"',
  'Found new key type "pets.XX" type "String"',
  'Found new key type "someWeirdLegacyKey" type "String"'
];



describe('Continuous logging', async () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should log every new key', async () => {
    const output = await test.runAnalysis({collection:'users', logKeysContinuously:true});
    var filteredOutput = output
      .split('\n')
      .filter(line => line.match(pattern));
    assert.equal(filteredOutput.length, expectedLines.length);
    expectedLines.forEach(expectedLine => {
      const found = filteredOutput.indexOf(expectedLine) > -1;
      assert.ok(found, `Expected line '${expectedLine}' not found in Variety output`);
    });
  });
});
