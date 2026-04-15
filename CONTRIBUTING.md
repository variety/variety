# Contributing to Variety

This document covers setup, repo layout, testing, linting, and how to report issues or send patches. For user-facing usage and features, see [README.md](README.md).

## Setup

This project is NPM based and provides standard NPM functionality. Development and testing add local npm dev dependencies, which you install as usual:

```
npm install
```

As an additional (not required) dependency, [Docker](https://www.docker.com/) or [Podman](https://podman.io/) can be installed to test against different MongoDB versions.

## Repo Layout and the `variety.js` Build

`variety.js` at the repo root is a generated file, assembled from two sources:

- `src/impl.js` — pure, transport-agnostic analysis logic.
- `src/interface.js` — the shell-facing layer that reads shell globals
  (`collection`, `plugins`, `slaveOk`, etc.), loads plugins, and hands
  dependencies to `impl.run()`.
- `bin/variety` — the published Node entrypoint that implements the main
  CLI surface.
- `lib/cli*.js`, `lib/mongo-shell.js` — Node-side CLI parsing, compatibility
  handling, and Mongo shell invocation helpers.

`build.js` concatenates those two files under a generated-file banner. Edit the sources in `src/`, then run:

```
npm run build
```

The built `variety.js` is committed to the repository so that `mongosh variety.js` works from a fresh clone without a build step. CI runs `npm run verify:build`, which re-assembles the file in memory and fails the build if the committed `variety.js` drifts from its sources. If you see that check fail, run `npm run build` and commit the updated `variety.js`.

## Testing

`npm test` runs ESLint plus the default Docker-backed integration test lane. If you already have MongoDB listening on `localhost:27017` and want to run only the mocha suite directly, use:

```
npm run test:mocha
```

The test suite under `spec/` runs as native ESM through its own `spec/package.json`, while the repository root intentionally stays CommonJS so the CLI entrypoint and config files keep their current behavior. That Mocha lane also includes focused CLI specs that execute `bin/variety` and stub `mongosh` / `mongo`, so the command-line translation layer can be validated without a live MongoDB shell install.

If you have Docker or Podman installed and don't want to test against your own MongoDB instance,
you can execute tests against dockerized MongoDB:

```
npm run test:docker
```

The script downloads one of [the official MongoDB images](https://hub.docker.com/_/mongo/) (based on your provided version),
starts the database, executes the test suite against it (inside the container) and stops the DB.

The Docker harness prefers `mongosh` when it is available and falls back to the legacy `mongo` shell for older images.

Dockerized tests default to MongoDB 8.0 on Node.js 22. You can override `MONGODB_VERSION` and `NODEJS_VERSION` when you want to try another supported combination:

```
MONGODB_VERSION=7.0 npm run test:docker
MONGODB_VERSION=8.0 npm run test:docker
MONGODB_VERSION=8.0 NODEJS_VERSION=24 npm run test:docker
```

GitHub Actions runs a MongoDB matrix on Node.js 22: `5.0` (which ships only the legacy `mongo` shell, exercising that code path), `7.0`, and `8.0` (both of which ship only `mongosh`). A single Node.js 24 smoke test also runs against MongoDB 8.0. MongoDB 6.0+ no longer ships the legacy `mongo` shell, so `5.0` is the newest version available for `mongo`-shell coverage.

## Linting

Variety keeps its repository checks split into a few layers so it is clear which tool is complaining and why.

### Pre-commit Hooks

Pre-commit hooks are managed by [Husky](https://typicode.github.io/husky/) and installed automatically on `npm install`. Each commit runs all of the following, and is blocked if any fail:

- `npm run verify:build` — verifies `variety.js` matches what `build.js` would produce from `src/`
- `npm run lint` — ESLint (JavaScript)
- `npm run lint:json` — `@prantlf/jsonlint` (JSON files)
- `npm run lint:markdown` — markdownlint (Markdown files)
- `npm run lint:yaml` — js-yaml (YAML files)
- `npm run lint:dockerfile` — hadolint (`docker/Dockerfile.template`)
- `npm run lint:shell` — shellcheck (shell scripts)
- `npm run typecheck` — TypeScript `checkJs`/JSDoc validation for `bin/variety`, `lib/**/*.js`, `.eslint.config.js`, `build.js`, and Node-side spec code under `spec`

### ESLint Rulesets

#### Shared Baseline

`npm run lint` applies a shared baseline of formatting and safety rules across the repo. That baseline also bans a few repo-specific legacy patterns, including `Function('return this')`, `indexOf(...)` presence checks, and unguarded `for...in` loops.

#### Node-side Modernization

Node-side JavaScript such as `bin/variety`, `lib/**/*.js`, `.eslint.config.js`, `build.js`, and the test suite under `spec/` (excluding shell-executed fixtures under `spec/assets/`) opts into a stricter modernization set: `const`, template literals, object shorthand, `Object.hasOwn`, and throwing `Error` objects.

#### Legacy Shell Compatibility

`variety.js` and its sources under `src/` use the subset of those rules that is safe for the ES6+ JavaScript supported by the legacy `mongo` shell since MongoDB 4.4: `no-var`, `prefer-const`, `prefer-template`, `object-shorthand`, and `no-throw-literal`. `prefer-object-has-own` is intentionally excluded there because `Object.hasOwn()` is not guaranteed in that runtime, and all `hasOwnProperty.call()` usages have been replaced by `Object.keys()` / `in`.

### Typed Checks For Node-side Code

#### Checked Files

`npm run typecheck` runs TypeScript `checkJs` over the published Node CLI surface (`bin/variety` plus `lib/**/*.js`), `.eslint.config.js`, `build.js`, and the Node-side spec code via `.tsconfig.checkjs.json`. The `spec` tree also uses type-aware `typescript-eslint` rules, while shell-executed fixtures under `spec/assets` stay on the shared baseline.

#### Extra Strictness

That pass enables stricter flags such as `noImplicitReturns`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, and `exactOptionalPropertyTypes`. Both ESLint and `npm run test:mocha` now rely on native Node parsing for repo code, with `spec/package.json` marking the test tree as ESM while the repository root remains CommonJS so the CLI entrypoint and config files keep their current behavior.

### Container-backed Linters

`npm run lint:dockerfile` and `npm run lint:shell` run inside containers. [Docker](https://www.docker.com/) is used if available, with [Podman](https://podman.io/) as a fallback. At least one must be installed. `npm run lint:shell` now covers the remaining shell scripts (`docker/init.sh` and `spec/bin/test-on-docker.sh`), while the published `bin/variety` entrypoint is linted as Node-side JavaScript.

## Reporting Issues / Contributing

Please report any bugs and feature requests on the Github issue tracker. I will read all reports!

I accept pull requests from forks. Very grateful to accept contributions from folks.
