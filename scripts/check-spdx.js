#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2012–2026 James Kirk Cropcho <numerate_penniless652@dralias.com>
'use strict';

// Verifies that every git-tracked source file carries both SPDX-License-Identifier
// and SPDX-FileCopyrightText tags.  Run via `npm run lint:spdx`; also enforced by
// the Husky pre-commit hook.

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

const REQUIRED_TAGS = ['SPDX-License-Identifier:', 'SPDX-FileCopyrightText:'];

let failures = 0;
for (const file of files) {
  const head = fs.readFileSync(file, 'utf8').split('\n').slice(0, 15).join('\n');
  for (const tag of REQUIRED_TAGS) {
    if (!head.includes(tag)) {
      console.error(`Missing ${tag} in: ${file}`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} missing SPDX tag(s) across ${files.length} checked files.`);
  process.exit(1);
}

console.log(`SPDX-License-Identifier + SPDX-FileCopyrightText present in all ${files.length} checked files.`);
