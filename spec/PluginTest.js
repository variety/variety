import assert from 'assert';
import Tester from './utils/Tester.js';
import { resolve, join } from 'path';
import sampleData from './assets/SampleData';

const test = new Tester('test', 'users');

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

const getPluginPath = () => resolve(join(__dirname , 'assets', 'csvplugin.js'));

describe('Plugins', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should load plugin and modify output', async () => {
    const output = await test.runAnalysis({collection:'users', plugins: getPluginPath()}, true);
    assert.equal(output, expectedOutput);
  });

  it('should read additional plugin params', async () => {
    const output = await test.runAnalysis({collection:'users', plugins: getPluginPath() + '|delimiter=;'}, true);
    const expectedWithSeparator = expectedOutput.replace(/\|/g, ';');
    assert.equal(output, expectedWithSeparator);
  });

});
