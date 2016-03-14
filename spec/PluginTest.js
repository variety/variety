const assert = require('assert');
const Tester = require('./utils/Tester.js');
const path = require('path');
const test = new Tester('test', 'users');

const sampleData = require('./assets/SampleData');

const expectedOutput = `
key|types|occurrences|percents
_id|ObjectId|5|100
name|String|5|100
bio|String|3|60
birthday|Date|2|40
pets|Array,String|2|40
someBinData|BinData-generic|1|20
someWeirdLegacyKey|String|1|20
`.trim();

const getPluginPath = () => path.resolve(path.join(__dirname , 'assets', 'csvplugin.js'));

describe('Plugins', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should load plugin and modify output', () => {
    return test.runAnalysis({collection:'users', plugins: getPluginPath()}, true).then(output => {
      assert.equal(output, expectedOutput);
    });
  });

  it('should read additional plugin params', () => {
    return test.runAnalysis({collection:'users', plugins: getPluginPath() + '|delimiter=;'}, true).then(output => {
      const expectedWithSeparator = expectedOutput.replace(/\|/g, ';');
      assert.equal(output, expectedWithSeparator);
    });
  });

});
