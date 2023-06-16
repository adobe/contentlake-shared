# Content Lake Shared

> Shared libraries for Asset Catalog (Content Lake).

This is a monorepo and the various libraries can be found in [packages](packages/).

## Status

[![codecov](https://img.shields.io/codecov/c/github/adobe/contentlake-shared.svg)](https://codecov.io/gh/adobe/contentlake-shared)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/contentlake-shared.svg)](https://circleci.com/gh/adobe/contentlake-shared)
[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/issues)
[![Known Vulnerabilities](https://snyk.io/test/github/adobe/contentlake-shared/badge.svg?targetFile=package.json)](https://snyk.io/test/github/adobe/contentlake-shared?targetFile=package.json)

## Usage

### Installation

Install the desired [library](packages) using npm, for example:

```
npm install @adobe/contentlake-shared-frontegg-auth
```

Packages are named `@adobe/contentlake-shared-<folder>` with `<folder>` being the project's folder name under [packages](packages/).

Then import the APIs you need:

```javascript
import { something } from `@adobe/@adobe/contentlake-shared-frontegg-auth`;

// ...

something();
```

Please see the [API Documentation](docs/API.md) and the [project's](packages/) individual READMEs for detailed documentation.

### Documentation

[API Documentation](docs/API.md)


## Development


### Build

```bash
npm install
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

Note: the linter runs as git pre-commit hook. (Installed during `npm install` using [husky](https://github.com/typicode/husky)).

### VS Code

To use this monorepo with VS Code [Multi-root workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces) there is a [contentlake-shared.code-workspace](contentlake-shared.code-workspace) file. This needs to be updated if new projects are added under [packages](packages/).
