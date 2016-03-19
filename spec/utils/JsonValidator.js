'use strict';

const assert = require('assert');

class JsonValidator {
  constructor(results) {
    this.results = results;
  }

  validate(key, totalOccurrences, percentContaining, types) {
    let row = this.results.filter(item => item._id.key === key)[0];
    if(typeof row === 'undefined') {
      throw new Error(`Key '${key}' is not present in results`);
    }
    assert.equal(row.totalOccurrences, totalOccurrences, `TotalOccurrences of key ${key} does not match`);
    assert.equal(row.percentContaining, percentContaining, `PercentContaining of key ${key} does not match`);
    assert.deepEqual(row.value.types, types, `Types of key ${key} do not match`);
  }

  validateResultsCount(count) {
    assert.equal(this.results.length, count, 'Total count of results does not match expected count.');
  }
}

module.exports = JsonValidator;
