# Content Lake Shared - blob-storage

> Blob storage library for Asset Catalog

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-blob-storage
```

```
import { BlobStorage } from '@adobe/contentlake-shared-blob-storage'

const blobStorage = new BlobStorage(config);
const binary = await blobStorage.get('key')
```
