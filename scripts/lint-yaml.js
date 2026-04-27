#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = process.cwd();
const YAML_EXTENSIONS = new Set(['.yml', '.yaml']);
const IGNORED_DIRECTORY_NAMES = new Set(['.git', '.worktrees', 'node_modules']);
const IGNORED_RELATIVE_DIRECTORIES = new Set(['.claude/worktrees']);

function isIgnoredDirectory(relativePath, entryName) {
  if (IGNORED_DIRECTORY_NAMES.has(entryName)) {
    return true;
  }
  if (IGNORED_RELATIVE_DIRECTORIES.has(relativePath)) {
    return true;
  }
  return false;
}

function findYamlFiles(relativeDirectory = '') {
  const absoluteDirectory = path.join(ROOT, relativeDirectory);
  const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? path.posix.join(relativeDirectory, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      if (isIgnoredDirectory(relativePath, entry.name)) {
        continue;
      }
      files.push(...findYamlFiles(relativePath));
      continue;
    }

    if (entry.isFile() && YAML_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
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
    yaml.loadAll(fs.readFileSync(path.join(ROOT, file), 'utf8'), () => {}, {});
  } catch (error) {
    reportFailure(file, error);
    failures++;
  }
}

if (failures > 0) {
  process.exit(1);
}
