# Content Lake Shared - Search Index

> Wrapper for using Algolia Search Index JS API

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-search-index
```

Use with:

```
import { SearchIndex } from '@adobe/contentlake-shared-search-index';


const searchIndex = new SearchIndex(context, companyId);

saveResult = await searchIndex.save({
  file: '234.jpg',
  sourceName: 'file-2.jpg',
  tags: ['animal', 'cat']
});
```