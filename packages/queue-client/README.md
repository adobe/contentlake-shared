# Content Lake Shared - Queue Client

> Queue library for Asset Catalog

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-queue-client
```

```
import { QueueClient } from '@adobe/contentlake-shared-queue-client'

const queueClient = new QueueClient({
    queueUrl: 'https://somequeue.com'
});
await queueClient.sendMessage({ message: 'Hello World' });
```
