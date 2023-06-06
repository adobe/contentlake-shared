# Content Lake Shared

> Shared libraries for Asset Catalog (Content Lake).

This is a monorepo and the various libraries can be found in [packages](packages/).

## Status

[![NPM Version](https://img.shields.io/npm/v/@adobe/content-lake-shared.svg)](https://www.npmjs.com/package/@adobe/content-lake-shared)
[![codecov](https://img.shields.io/codecov/c/github/adobe/content-lake-shared.svg)](https://codecov.io/gh/adobe/content-lake-shared)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/content-lake-shared.svg)](https://circleci.com/gh/adobe/content-lake-shared)
[![GitHub license](https://img.shields.io/github/license/adobe/content-lake-shared.svg)](https://github.com/adobe/content-lake-shared/blob/main/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/content-lake-shared.svg)](https://github.com/adobe/content-lake-shared/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/content-lake-shared.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/content-lake-shared) 
[![Known Vulnerabilities](https://snyk.io/test/github/adobe/content-lake-shared/badge.svg?targetFile=package.json)](https://snyk.io/test/github/adobe/content-lake-shared?targetFile=package.json)

## Usage

### Installation

Install the desired [library](packages) using npm, for example:

```
npm install @adobe/content-lake-shared-auth
```

Packages are named `@adobe/content-lake-shared-<folder>` with `<folder>` being the project's folder name under [packages](packages/).

Then import the APIs you need:

```javascript
import { something } from `@adobe/content-lake-shared-auth`;

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

To use this monorepo with VS Code [Multi-root workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces) there is a [content-lake-shared.code-workspace](content-lake-shared.code-workspace) file. This needs to be updated if new projects are added under [packages](packages/).

