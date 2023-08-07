# Content Lake Shared - functions

> Library for invoking functions for Asset Catalog

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-functions
```

Example usage:

```
import { FunctionRunner } from '@adobe/contentlake-shared-functions';

const runner = new FunctionRunner();
await runner.invokeFunction('test-function', {
    param1: true
});
```