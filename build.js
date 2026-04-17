#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';

// Assembles variety.js by concatenating the formatter files, core/analyzer.js, and
// mongo-shell/adapter.js underneath a generated-file banner. The built variety.js
// is committed to the repository so `mongosh variety.js` works from a fresh clone without
// running a build step first; CI runs this script and fails if the
// committed file drifts from its sources.

const fs = require('fs');
const path = require('path');

const HEADER = `// SPDX-License-Identifier: MIT
/* Variety: A MongoDB Schema Analyzer

This tool helps you get a sense of your application's schema, as well as any
outliers to that schema. Particularly useful when you inherit a codebase with
data dump and want to quickly learn how the data's structured. Also useful for
finding rare keys.

Please see https://github.com/variety/variety for details.

Released by James Cropcho, © 2012–2026, under the MIT License. */

// -----------------------------------------------------------------------------
// GENERATED FILE — do not edit directly.
//
// Assembled by build.js from:
//   core/formatters/ascii.js, core/formatters/json.js,
//   core/analyzer.js, mongo-shell/adapter.js.
// To change behavior, edit those source files and run \`npm run build\`. The
// build output is committed so \`mongosh variety.js\` works from a fresh clone
// without a build step; CI verifies the committed file matches its sources.
// -----------------------------------------------------------------------------

// JavaScript compatibility floor: this file runs inside a MongoDB shell —
// either mongosh (all versions, modern V8) or the legacy \`mongo\` shell
// (SpiderMonkey-based, shipped through MongoDB 5.x). The lowest common
// denominator is the ES6+ feature set available in the legacy shell since
// MongoDB 4.4: let/const, arrow functions, template literals, rest/spread,
// for…of, Object.keys()/Object.entries(), and class. Later additions such
// as Object.hasOwn() (ES2022) are absent and must not be used here.
// See .eslint.config.js for the enforced rule set.

// -----------------------------------------------------------------------------
// This file is organized in four sections, sourced from four separate files:
//
//   1. FORMATTER SECTION (core/formatters/ascii.js, core/formatters/json.js) —
//      built-in output formatters. Each is a self-contained IIFE that registers
//      a factory function on \`shellContext.__varietyFormatters\`. Third-party
//      formatters can be supplied as plugins instead (see README).
//
//   2. IMPLEMENTATION SECTION (core/analyzer.js) — pure, transport-agnostic
//      analysis logic. Functions take their dependencies (config, and where
//      needed a \`log\` function or a \`deps\` bag holding shell primitives)
//      as explicit parameters. The section hands a bundle of functions to
//      the interface section via \`shellContext.__varietyImpl\`.
//
//   3. INTERFACE SECTION (mongo-shell/adapter.js) — everything that touches
//      shell globals: reading input (\`collection\`, \`plugins\`, \`__quiet\`,
//      \`slaveOk\`, etc.), the config-echo logging, plugin loading via
//      \`load()\`, input validation, and constructing the dependency bag
//      passed to \`impl.run()\`.
//
// The handoff properties are deleted at the end so the build is idempotent and
// does not pollute the shell's global namespace after execution.
// -----------------------------------------------------------------------------
`;

const root = __dirname;
const fmtAscii = fs.readFileSync(path.join(root, 'core', 'formatters', 'ascii.js'), 'utf8');
const fmtJson  = fs.readFileSync(path.join(root, 'core', 'formatters', 'json.js'), 'utf8');
const impl     = fs.readFileSync(path.join(root, 'core', 'analyzer.js'), 'utf8');
const iface    = fs.readFileSync(path.join(root, 'mongo-shell', 'adapter.js'), 'utf8');

// HEADER ends with a single \n; each source file ends with a single \n. We
// want two blank lines (three \n total) between each region in the output.
const output = `${HEADER}\n\n${fmtAscii}\n\n${fmtJson}\n\n${impl}\n\n${iface}`;

const outPath = path.join(root, 'variety.js');

const args = process.argv.slice(2);
if (args.includes('--check')) {
  const existing = fs.readFileSync(outPath, 'utf8');
  if (existing !== output) {
    process.stderr.write(
      'variety.js is out of date relative to its sources (core/formatters/, core/analyzer.js, mongo-shell/adapter.js).\n' +
      'Run `npm run build` and commit the updated variety.js.\n'
    );
    process.exit(1);
  }
  process.stdout.write('variety.js is up to date.\n');
} else {
  fs.writeFileSync(outPath, output);
  process.stdout.write(`Wrote ${path.relative(root, outPath)} (${output.length} bytes).\n`);
}
