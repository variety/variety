# Contributing to Variety

This document covers the repository's linting layers and how to report issues or send patches. For architecture, repo layout, and the `variety.js` build, see [README.md](README.md).

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
- `npm run typecheck` — TypeScript `checkJs`/JSDoc validation for `.eslint.config.js`, `build.js`, and Node-side spec code under `spec`

### ESLint Rulesets

#### Shared Baseline

`npm run lint` applies a shared baseline of formatting and safety rules across the repo. That baseline also bans a few repo-specific legacy patterns, including `Function('return this')`, `indexOf(...)` presence checks, and unguarded `for...in` loops.

#### Node-side Modernization

Node-side JavaScript such as `.eslint.config.js`, `build.js`, and the test suite under `spec/` (excluding shell-executed fixtures under `spec/assets/`) opts into a stricter modernization set: `const`, template literals, object shorthand, `Object.hasOwn`, and throwing `Error` objects.

#### Legacy Shell Compatibility

`variety.js` and its sources under `src/` use the subset of those rules that is safe for the ES6+ JavaScript supported by the legacy `mongo` shell since MongoDB 4.4: `no-var`, `prefer-const`, `prefer-template`, `object-shorthand`, and `no-throw-literal`. `prefer-object-has-own` is intentionally excluded there because `Object.hasOwn()` is not guaranteed in that runtime, and all `hasOwnProperty.call()` usages have been replaced by `Object.keys()` / `in`.

### Typed Checks For Node-side Code

#### Checked Files

`npm run typecheck` runs TypeScript `checkJs` over `.eslint.config.js`, `build.js`, and the Node-side spec code via `.tsconfig.checkjs.json`. The `spec` tree also uses type-aware `typescript-eslint` rules, while shell-executed fixtures under `spec/assets` stay on the shared baseline.

#### Extra Strictness

That pass enables stricter flags such as `noImplicitReturns`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, and `exactOptionalPropertyTypes`. Both ESLint and `npm run test:mocha` now rely on native Node parsing for repo code, with `spec/package.json` marking the test tree as ESM while the repository root remains CommonJS so the CLI entrypoint and config files keep their current behavior.

### Container-backed Linters

`npm run lint:dockerfile` and `npm run lint:shell` run inside containers. [Docker](https://www.docker.com/) is used if available, with [Podman](https://podman.io/) as a fallback. At least one must be installed.

## Reporting Issues / Contributing

Please report any bugs and feature requests on the Github issue tracker. I will read all reports!

I accept pull requests from forks. Very grateful to accept contributions from folks.
