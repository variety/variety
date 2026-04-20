# Contributing to Variety

This document covers setup, repo layout, testing, linting, and how to report issues or send patches. For user-facing usage and features, see [README.md](README.md).

## Setup

This project is NPM based and provides standard NPM functionality. Development and testing add local npm dev dependencies, which you install as usual:

```
npm install
```

As an additional (not required) dependency, [Docker](https://www.docker.com/) or [Podman](https://podman.io/) can be installed to test against different MongoDB versions.

## Repo Layout and the `variety.js` Build

`variety.js` at the repo root is a generated file, assembled from four sources in this order:

- `core/formatters/ascii.js` — built-in ASCII table formatter. Self-contained
  IIFE; registers an `ascii` factory on `shellContext.__varietyFormatters`.
- `core/formatters/json.js` — built-in JSON formatter. Self-contained IIFE;
  registers a `json` factory on `shellContext.__varietyFormatters`.
- `core/analyzer.js` — pure, transport-agnostic analysis logic. No runtime
  dependencies on shell globals, Node I/O, or any other layer. Reads
  `shellContext.__varietyFormatters` to dispatch output. This is the
  future `@variety/core` package boundary.
- `mongo-shell/adapter.js` — the shell-facing layer that reads shell
  globals (`collection`, `plugins`, `slaveOk`, etc.), loads plugins, and
  hands dependencies to `impl.run()`. The only place in the build that
  touches `db`, `print`, and `load`. Cleans up both `__varietyImpl` and
  `__varietyFormatters` after execution so repeated loads are idempotent.
  Depends on `core`; compiled into `variety.js` by `build.js` (not a
  separately published package).
- `bin/variety` — the published Node entrypoint that implements the main
  CLI surface.
- `mongo-shell/launcher.js` — Node-side Mongo shell invocation helpers.
  The only place that touches Node `spawnSync` for spawning `mongosh`/`mongo`.
  Future interfaces (MCP, etc.) can import from `mongo-shell/` without
  reaching into `cli/`.
- `cli/main.js`, `cli/options.js` — Node-side CLI parsing and compatibility
  handling. Depends on `core` and `mongo-shell/`; this is the future
  `@variety/cli` package boundary.

**Dependency directions:** `core/formatters/` has no runtime deps on any other
layer. `core` depends on `core/formatters/`. `mongo-shell/adapter.js` depends on
`core`. `mongo-shell/launcher.js` is Node-only (no `core` dep). `cli` depends on
`core` and `mongo-shell/`. `build.js` composes `core/formatters/` + `core` +
`mongo-shell/adapter.js` → `variety.js`.

`build.js` concatenates those source files under a generated-file banner.
Edit the sources in `core/` or `mongo-shell/adapter.js`, then run:

```
npm run build
```

The built `variety.js` is committed to the repository so that `mongosh variety.js` works from a fresh clone without a build step. CI runs `npm run verify:build`, which re-assembles the file in memory and fails the build if the committed `variety.js` drifts from its sources. If you see that check fail, run `npm run build` and commit the updated `variety.js`.

## Testing

`npm test` runs ESLint plus the default Docker-backed integration test lane. If you already have MongoDB listening on `localhost:27017` and want to run only the mocha suite directly, use:

```
npm run test:mocha
```

The test suite under `test/` runs as native ESM through its own `test/package.json`, while the repository root intentionally stays CommonJS so the CLI entrypoint and config files keep their current behavior. Tests are grouped by concern under `test/cases/` — `test/cases/analysis/`, `test/cases/cli/`, `test/cases/formatters/`, `test/cases/persistence/`, and `test/cases/plugins/` — with shared helpers under `test/helpers/` and static inputs under `test/fixtures/`. That Mocha lane also includes focused CLI tests that execute `bin/variety` and stub `mongosh` / `mongo`, so the command-line translation layer can be validated without a live MongoDB shell install.

If you have Docker or Podman installed and don't want to test against your own MongoDB instance,
you can execute tests against dockerized MongoDB:

```
npm run test:container
```

The script downloads one of [the official MongoDB images](https://hub.docker.com/_/mongo/) (based on your provided version),
starts the database, executes the test suite against it (inside the container) and stops the DB.

The Docker harness prefers `mongosh` when it is available and falls back to the legacy `mongo` shell for older images.

Dockerized tests default to MongoDB 8.0 on Node.js 22. You can override `MONGODB_VERSION` and `NODEJS_VERSION` when you want to try another supported combination:

```
MONGODB_VERSION=7.0 npm run test:container
MONGODB_VERSION=8.0 npm run test:container
MONGODB_VERSION=8.0 NODEJS_VERSION=24 npm run test:container
```

GitHub Actions runs a MongoDB matrix on Node.js 22: `5.0` (which ships only the legacy `mongo` shell, exercising that code path), `7.0`, and `8.0` (both of which ship only `mongosh`). A single Node.js 24 smoke test also runs against MongoDB 8.0. MongoDB 6.0+ no longer ships the legacy `mongo` shell, so `5.0` is the newest version available for `mongo`-shell coverage.

In GitHub Actions, Dockerized test jobs opt into Docker Buildx's GitHub
Actions cache for the generated test images. Cache scopes are separated by
runner OS/architecture, MongoDB version, and Node.js version. This cache is
only an optimization: cache misses, unavailable cache support, or cache-backed
build failures fall back to a clean `docker build --no-cache` rebuild so CI
behavior remains predictable. Local `npm run test:container` runs keep the clean
rebuild behavior by default.

GitHub Actions also runs CodeQL and OpenSSF Scorecard security scans. OpenSSF
Scorecard runs on pushes to `main` and weekly on `main`, uploads SARIF results
to GitHub code scanning, and keeps `publish_results: false` so results are not
published to the OpenSSF REST API or README badges until maintainers explicitly
enable public publishing.

GitHub Actions workflows pin third-party actions to full commit SHAs with a
nearby version comment for reviewability. CI jobs install NPM dependencies with
`npm ci` so GitHub Actions uses the committed lockfile exactly.

## Linting

Variety keeps its repository checks split into a few layers so it is clear which tool is complaining and why.

### Pre-commit Hooks

Pre-commit hooks are managed by [Husky](https://typicode.github.io/husky/) and installed automatically on `npm install`. Each commit is blocked if any applicable check fails.

If every staged change is a modification to an existing `.md` file (no new or deleted files), only `npm run lint:markdown` runs — all other checks are skipped as they have nothing to verify.

Otherwise all of the following run:

- `npm run verify:build` — verifies `variety.js` matches what `build.js` would produce from `core/formatters/`, `core/`, and `mongo-shell/adapter.js`
- `npm run lint` — ESLint (JavaScript)
- `npm run lint:json` — `@prantlf/jsonlint` (JSON files)
- `npm run lint:markdown` — markdownlint (Markdown files)
- `npm run lint:yaml` — js-yaml (YAML files)
- `npm run lint:dockerfile` — hadolint (`docker/Dockerfile.template`)
- `npm run lint:shell` — shellcheck (shell scripts)
- `npm run lint:spdx` — verifies `SPDX-License-Identifier: MIT` headers in all tracked source files
- `npm run typecheck` — TypeScript `checkJs`/JSDoc validation for `bin/variety`, `cli/**/*.js`, `.eslint.config.js`, `build.js`, and Node-side test code under `test`

### ESLint Rulesets

#### Shared Baseline

`npm run lint` applies a shared baseline of formatting and safety rules across the repo. That baseline also bans a few repo-specific legacy patterns, including `Function('return this')`, `indexOf(...)` presence checks, and unguarded `for...in` loops.

#### Node-side Modernization

Node-side JavaScript such as `bin/variety`, `cli/**/*.js`, `mongo-shell/launcher.js`, `.eslint.config.js`, `build.js`, and the test suite under `test/` (excluding shell-executed fixtures under `test/fixtures/`) opts into a stricter modernization set: `const`, template literals, object shorthand, `Object.hasOwn`, and throwing `Error` objects.

#### Legacy Shell Compatibility

`variety.js` and its sources under `core/` and `mongo-shell/adapter.js` use the subset of those rules that is safe for the ES6+ JavaScript supported by the legacy `mongo` shell since MongoDB 4.4: `no-var`, `prefer-const`, `prefer-template`, `object-shorthand`, and `no-throw-literal`. `prefer-object-has-own` is intentionally excluded there because `Object.hasOwn()` is not guaranteed in that runtime, and all `hasOwnProperty.call()` usages have been replaced by `Object.keys()` / `in`.

### Typed Checks For Node-side Code

#### Checked Files

`npm run typecheck` runs TypeScript `checkJs` over the published Node CLI surface (`bin/variety` plus `cli/**/*.js` and `mongo-shell/launcher.js`), `.eslint.config.js`, `build.js`, and the Node-side test code via `.tsconfig.checkjs.json`. The `test` tree also uses type-aware `typescript-eslint` rules, while shell-executed fixtures under `test/fixtures` stay on the shared baseline.

#### Extra Strictness

That pass enables stricter flags such as `noImplicitReturns`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, and `exactOptionalPropertyTypes`. Both ESLint and `npm run test:mocha` now rely on native Node parsing for repo code, with `test/package.json` marking the test tree as ESM while the repository root remains CommonJS so the CLI entrypoint and config files keep their current behavior.

### SPDX License Headers

All source files — `.js`, `.sh`, `.yml`/`.yaml`, `docker/Dockerfile.template`, and `bin/variety` — must open with an `SPDX-License-Identifier: MIT` comment. `npm run lint:spdx` verifies this for every git-tracked file in those categories and is enforced by the pre-commit hook.

When adding a new source file, put both tags on the first two lines (or immediately after the shebang for executable scripts):

```js
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
```

```sh
#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
```

**Copyright year convention:** use the year the file was *first committed to git* — never a range. To look it up: `git log --diff-filter=A --format="%ad" --date=format:"%Y" -- <file>`. Rationale: [REUSE FAQ §years-copyright](https://reuse.software/faq/#years-copyright) → [Matija Šuklje — how and why to properly write copyright statements](https://matija.suklje.name/how-and-why-to-properly-write-copyright-statements-in-your-code#tldr).

`npm run lint:spdx` enforces the presence of both tags and validates that `SPDX-FileCopyrightText` uses a single year (not a range). The correct year value is left to author judgement at review time.

The two tags are injected into `variety.js` automatically via the `HEADER` constant in `build.js`; they do not need to be added manually to that generated file.

### Container-backed Linters

`npm run lint:dockerfile` and `npm run lint:shell` run inside containers. [Docker](https://www.docker.com/) is used if available, with [Podman](https://podman.io/) as a fallback. At least one must be installed. `npm run lint:shell` now covers the remaining shell scripts (`docker/init.sh` and `test/bin/test-in-container.sh`), while the published `bin/variety` entrypoint is linted as Node-side JavaScript.

## Writing a Plugin

A plugin is a CommonJS module (`.js` file) that exports a plain object. Variety calls any hooks it finds on that object; omit the ones you don't need.

### Hooks

| Hook | Signature | Notes |
| --- | --- | --- |
| `init` | `init(pluginConfig)` | Called once after the plugin is loaded. `pluginConfig` is a key/value object parsed from the `\|key=value` suffix in the `plugins` option. |
| `onConfig` | `onConfig(config)` | Called once after Variety's full config is resolved. Use this to read analysis settings. |
| `formatResults` | `formatResults(results)` → `string` | Called after analysis. The returned string is printed instead of the built-in formatter. Omit this hook to keep the default output format. |

### Minimal example

```js
// my-plugin.js
module.exports = {
  formatResults(results) {
    return results.map((r) => `${r._id.key}: ${r.percentContaining}%`).join('\n');
  },
};
```

Run it:

```bash
mongosh test --quiet --eval "var collection='users', plugins='./my-plugin.js'" variety.js
```

### Example with configuration

```js
// csv-plugin.js
let delimiter = ',';

module.exports = {
  init(cfg) {
    if (cfg.delimiter) { delimiter = cfg.delimiter; }
  },
  formatResults(results) {
    const headers = ['key', 'types', 'occurrences', 'percents'];
    const rows = results.map((r) =>
      [r._id.key, Object.keys(r.value.types).join('+'), r.totalOccurrences, r.percentContaining].join(delimiter)
    );
    return [headers.join(delimiter), ...rows].join('\n');
  },
};
```

Pass config via the `|` separator:

```bash
mongosh test --quiet --eval "var collection='users', plugins='./csv-plugin.js|delimiter=;'" variety.js
```

### Testing a plugin

Integration tests for plugins live in `test/cases/plugins/`. Copy the structure of `test/cases/plugins/PluginTest.js` and put your fixture file under `test/fixtures/`. The `VarietyHarness` helper's `runAnalysis({ plugins: getPluginPath() })` method is the easiest way to wire everything up.

## Reporting Issues / Contributing

Please follow the [Variety Code of Conduct](CODE_OF_CONDUCT.md) when participating in project spaces.

Please report bugs, feature requests, documentation issues, and usage questions
on the GitHub issue tracker. The repository includes issue forms for each of
those report types; choose the closest fit and include the requested details. I
will read all reports!

I accept pull requests from forks. Very grateful to accept contributions from folks.

Pull requests use the repository's GitHub pull request template. Please summarize
the change, link related issues when they exist, note documentation impact, and
include the checks you ran or explain why local checks were not run.

Maintainers prefer formal GitHub pull request reviews for human signoff, even
though approvals are not currently required by the branch rules. When someone
other than the PR author has reviewed a change and is comfortable with it, use
GitHub's **Review changes** flow and submit **Approve** instead of only leaving
comments.

That formal approval gives the project an auditable human review signal for
future maintainers and supply-chain checks such as OpenSSF Scorecard. Automated
review comments from Copilot, Codex, or other bots are useful, but they do not
replace human approval.
