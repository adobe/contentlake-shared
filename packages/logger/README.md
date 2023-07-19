# Content Lake Shared - Logger

> Custom logger for formatting logs in Coralogix for Asset Catalog

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-logger
```

Use `logger` (a wrapper function) with Helix Services:

```
import { logger } from '@adobe/contentlake-shared-logger';

function run(request, context) {
  context.log.setStep('dispatch');
  context.log.info('Lambda started');
  // log will look like:
  // JOB: a5d7813b-3e82-4b95-9b1f-75e3d0e300af REQ: 44dcc2df-010c-4a47-b7ee-87883a525175 STEP: dispatch MESSAGE: Lambda started
  return new Response('Lambda started');
}

export const main = wrap(run)
  .with(logger)
  .with(status);

```