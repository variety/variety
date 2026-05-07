#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = process.cwd();

function findYamlFiles() {
  return fs.readFileSync(0, 'utf8')
    .split('\0')
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function reportFailure(file, error) {
  const message = typeof error.toString === 'function'
    ? error.toString()
    : (error.message || String(error));
  console.error(`${file}: ${message}`);
}

let failures = 0;
for (const file of findYamlFiles()) {
  try {
    yaml.loadAll(fs.readFileSync(path.join(ROOT, file), 'utf8'), () => {});
  } catch (error) {
    reportFailure(file, error);
    failures++;
  }
}

if (failures > 0) {
  process.exit(1);
}
