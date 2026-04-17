// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2012–2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
// Regression test for https://github.com/variety/variety/issues/108
// When a query matches zero documents, Variety should produce empty output
// rather than crashing with "reduce of empty array with no initial value".

import assert from 'assert';
import Tester from '../utils/Tester.js';

const test = new Tester('test', 'users');

const sampleData = [
  { name: 'Alice', age: 30 },
  { name: 'Bob',   age: 25 }
];

describe('Empty results handling', () => {

  beforeEach(() => test.init(sampleData));
  afterEach(() => test.cleanUp());

  it('should render an ASCII table with headers when query matches no documents', async () => {
    const output = await test.runAnalysis({ collection: 'users', query: { name: 'NoSuchName' } }, true);
    assert.ok(output.includes('key'),         'Output should contain column header "key"');
    assert.ok(output.includes('types'),       'Output should contain column header "types"');
    assert.ok(output.includes('occurrences'), 'Output should contain column header "occurrences"');
    assert.ok(output.includes('percents'),    'Output should contain column header "percents"');
  });

  it('should return an empty JSON array when query matches no documents', async () => {
    const results = await test.runJsonAnalysis({ collection: 'users', query: { name: 'NoSuchName' } });
    results.validateResultsCount(0);
  });

});
