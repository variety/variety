'use strict';

import { equal, deepEqual }  from 'assert';

export default class JsonValidator {
  constructor(results) {
    this.results = results;
  }

  validate(key, totalOccurrences, percentContaining, types) {
    const row = this.results.filter(item => item._id.key === key)[0];
    if(typeof row === 'undefined') {
      throw new Error(`Key '${key}' not present in results. Known keys are: [${this.results.map(item => item._id.key).join(',')}].`);
    }
    equal(row.totalOccurrences, totalOccurrences, `TotalOccurrences of key ${key} does not match`);
    equal(row.percentContaining, percentContaining, `PercentContaining of key ${key} does not match`);
    deepEqual(row.value.types, types, `Types of key ${key} do not match`);
  }

  validateResultsCount(count) {
    equal(this.results.length, count, `Total count of results does not match expected count. Known keys are: [${this.results.map(item => item._id.key).join(',')}].`);
  }
}
