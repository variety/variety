const assert = require('assert');
const Tester = require('./utils/Tester.js');
const test = new Tester('test', 'users');

const sampleData = require('./assets/SampleData');

const pattern = /^Found new key type "(.{1,})" type "(.{1,})"$/g;
const expectedLines = `
Found new key type "_id" type "ObjectId"
Found new key type "name" type "String"
Found new key type "someBinData" type "BinData-generic"
Found new key type "bio" type "String"
Found new key type "pets" type "String"
Found new key type "birthday" type "Date"
Found new key type "pets" type "Array"
Found new key type "pets.XX" type "String"
Found new key type "someWeirdLegacyKey" type "String"
`.trim();



describe('Continuous logging', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should log every new key', () => {
    return test.runAnalysis({collection:'users', logKeysContinuously:true}).then(output => {
      var filteredOutput = output
        .split('\n')
        .filter(line => line.match(pattern))
        .join('\n');
      assert.equal(filteredOutput, expectedLines);
    });
  });
});
