# Content Lake Shared - Router

> A lite Router for Serverless functions presenting multiple HTTP routes

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-router
```

Use with:

```
import { Router } from '@adobe/contentlake-shared-router';

async function run(request, context) {
  const router = new Router();
  router.get(
    '/:id',
    (_req, params) => new Response(JSON.stringify({ id: params.id })),
  );
  return router.handle(request, context);
}
```