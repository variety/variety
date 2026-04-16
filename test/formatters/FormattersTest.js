import assert from 'assert';
import Tester from '../utils/Tester.js';
import sampleData from '../fixtures/SampleData.js';
import expectedAscii from '../fixtures/ExpectedAscii.js';

const test = new Tester('test', 'users');

describe('Formatter registry dispatch', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('dispatches to the ascii formatter when outputFormat is "ascii"', async () => {
    const output = await test.runAnalysis({collection: 'users', outputFormat: 'ascii'}, true);
    assert.equal(output, expectedAscii);
  });

  it('dispatches to the json formatter when outputFormat is "json"', async () => {
    const results = await test.runJsonAnalysis({collection: 'users'}, true);
    results.validateResultsCount(7);
    results.validate('_id', 5, 100.0, {ObjectId: 5});
  });

  it('throws for an unknown outputFormat', async () => {
    await assert.rejects(
      () => test.runAnalysis({collection: 'users', outputFormat: 'xml'}, true),
      (err) => {
        const output = /** @type {Error & { stdout?: string }} */ (err).stdout ?? '';
        assert.match(output, /Unknown outputFormat/);
        assert.match(output, /ascii/);
        assert.match(output, /json/);
        return true;
      }
    );
  });

});
