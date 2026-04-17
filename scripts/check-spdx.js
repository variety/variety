#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';

// Verifies that every git-tracked source file carries an SPDX-License-Identifier
// comment.  Run via `npm run lint:spdx`; also enforced by the Husky pre-commit hook.

const { execSync } = require('child_process');
const fs = require('fs');

// Returns true for paths that must carry an SPDX header.
function mustHaveSpdx(p) {
  if (p.endsWith('.js')) { return true; }
  if (p.endsWith('.sh')) { return true; }
  if (p.endsWith('.yml') || p.endsWith('.yaml')) { return true; }
  if (p === 'bin/variety') { return true; }
  if (p === 'docker/Dockerfile.template') { return true; }
  return false;
}

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter(mustHaveSpdx);

let failures = 0;
for (const file of files) {
  const head = fs.readFileSync(file, 'utf8').split('\n').slice(0, 15).join('\n');
  if (!head.includes('SPDX-License-Identifier:')) {
    console.error(`Missing SPDX-License-Identifier header: ${file}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} file(s) missing SPDX-License-Identifier headers.`);
  process.exit(1);
}

console.log(`SPDX-License-Identifier headers present in all ${files.length} checked files.`);
