/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
import { randomUUID } from 'crypto';
import assert from 'assert';
import { promisify } from 'util';
import { config } from 'dotenv';
import { SearchIndex } from '../src/index.js';

config();

/**
 * Generates a non-cryptographically-secure string of random alphanumeric characters of
 * the specified length.
 * @param {*} length length of the string to generate
 * @returns random string
 */
function randomString(length) {
  let buf = '';
  while (buf.length < length) {
    buf += Math.random().toString(36).slice(2);
  }
  buf = buf.substring(0, length);
  return buf;
}

function generateContentRecord() {
  return {
    jobId: randomUUID(),
    contentHash: randomString(32),
    thumbnailHash: randomString(32),
    sourceId: randomUUID(),
    sourceAssetId: randomUUID(),
    sourceName: 'pickle.png',
    sourcePath: '/test/pickle.png',
    lastModified: new Date().toISOString(),
    file: '/content/dam/pickle.png',
    type: 'image',
    size: 12345,
    width: 200,
    height: 600,
    sourceType: 's3',
    companyId: randomUUID(),
    spaceId: randomUUID(),
    assetIdentity: randomUUID(),
    tags: ['tag1', 'tag1'],
    caption: 'A really cool image of a pickle',
    color: 'silver',
    sourceUrl: 'https://my.aemassets.net/content/dam/pickle.png',
    c2paLevel: '1',
  };
}

// TODO:  Fix this to do exponential backoff via recursive call
const waitForRecord = promisify(setTimeout);

describe('Cloud Search Index Storage integration tests', async () => {
  const context = {
    env: {
      ALGOLIA_APP_NAME: process.env.ALGOLIA_APP_NAME,
      ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
      ALGOLIA_CI_INDEX: process.env.ALGOLIA_CI_INDEX,
    },
    log: console,
  };
  const searchIndexStorage = new SearchIndex(context);

  it('Save a record in cloud search index storage and check it exists', async () => {
    let saveResult;
    try {
      const contentRecord = generateContentRecord();
      saveResult = await searchIndexStorage.save(contentRecord);
      assert.notEqual(undefined, saveResult);

      await waitForRecord(12000);

      const exists = await searchIndexStorage.exists({
        contentHash: contentRecord.contentHash,
        sourceAssetId: contentRecord.sourceAssetId,
      });
      assert.strictEqual(exists.length, 1);
    } finally {
      if (saveResult?.objectID) {
        await searchIndexStorage.delete(saveResult.objectID);
      }
    }
  }).timeout(20000);
  it('Save a record in cloud search index storage for a company to `company-*` index', async () => {
    const newContext = {
      env: {
        ALGOLIA_APP_NAME: process.env.ALGOLIA_APP_NAME,
        ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
      },
      log: console,
    };
    const companyId = 'it-testcompanyid';
    const newSearchIndexStorage = new SearchIndex(newContext, companyId);
    assert.strictEqual(newSearchIndexStorage.getIndexName(), `company-details-${companyId}`);
    let saveResult;
    try {
      const contentRecord = generateContentRecord();
      contentRecord.companyId = companyId;
      saveResult = await newSearchIndexStorage.save(contentRecord);
      assert.notEqual(undefined, saveResult);

      await waitForRecord(12000);

      const exists = await newSearchIndexStorage.exists({
        contentHash: contentRecord.contentHash,
        sourceAssetId: contentRecord.sourceAssetId,
      });
      assert.strictEqual(exists.length, 1);
    } finally {
      if (saveResult?.objectID) {
        await newSearchIndexStorage.delete(saveResult.objectID);
      }
    }
  }).timeout(20000);

  it('Save a record in cloud search index storage and ensure it has the appropriate structure', async () => {
    const expectedFields = new Set(['objectID', 'assetIdentity', 'contentHash', 'sourceName', 'sourceType', 'thumbnailHash', 'file', 'companyId', 'spaceId', 'type', 'tags', 'caption', 'width', 'height', 'color', 'sourceId', 'sourceUrl', 'sourceAssetId', 'sourcePath', 'c2paLevel']);
    let saveResult;
    try {
      const contentRecord = generateContentRecord();
      saveResult = await searchIndexStorage.save(contentRecord);
      assert.notEqual(undefined, saveResult);

      await waitForRecord(10000);

      assert.ok(saveResult?.objectID);
      const { objectID } = saveResult;
      const getResult = await searchIndexStorage.get(objectID);

      assert.ok(getResult);
      assert.strictEqual(1, getResult.hits.length);
      const recordFields = Object.keys(getResult.hits[0]).reduce((a, v) => {
        // Algolia adds fields preceded by _ that we didn't create; ignore those
        if (!v.startsWith('_')) {
          a.push(v);
        }
        return a;
      }, []);
      for (const rField of recordFields) {
        assert.ok(expectedFields.has(rField), `Found unexpected field "${rField}"`);
      }
      for (const eField of expectedFields) {
        assert.ok(recordFields.includes(eField), `Expected field "${eField}" was not found`);
      }
      assert.strictEqual(expectedFields.size, recordFields.length);
    } finally {
      if (saveResult?.objectID) {
        await searchIndexStorage.delete(saveResult.objectID);
      }
    }
  }).timeout(20000);

  it('Get all objectIDs by contentHash', async () => {
    const contentHash = randomString(32);
    try {
      const contentRecord1 = {
        contentHash,
        sourceName: 'file1.png',
      };
      const contentRecord2 = {
        contentHash,
        sourceName: 'file2.png',
      };
      const saveResult1 = await searchIndexStorage.save(contentRecord1);
      const saveResult2 = await searchIndexStorage.save(contentRecord2);
      assert.notEqual(undefined, saveResult1);
      assert.notEqual(undefined, saveResult2);

      await waitForRecord(10000);

      const getResult = await searchIndexStorage.getObjectIdsByContentHash(contentHash);
      assert.ok(getResult);
      assert.strictEqual(getResult.length, 2);
    } finally {
      await searchIndexStorage.deleteBy('contentHash', contentHash);
    }
  }).timeout(20000);

  it('Update all content records that contain a contentHash', async () => {
    const contentHash = randomString(32);
    try {
      const contentRecord1 = {
        contentHash,
        sourceName: 'file1.png',
      };
      const contentRecord2 = {
        contentHash,
        sourceName: 'file2.png',
      };
      const saveResult1 = await searchIndexStorage.save(contentRecord1);
      const saveResult2 = await searchIndexStorage.save(contentRecord2);
      assert.notEqual(undefined, saveResult1);
      assert.notEqual(undefined, saveResult2);
      await waitForRecord(10000);

      await searchIndexStorage.updateByContentHash({ sourceType: 'test', contentHash });
      await waitForRecord(10000);

      const objectIDs = await searchIndexStorage.getObjectIdsByContentHash(contentHash);
      assert.strictEqual(objectIDs.length, 2);
      for (const objectID of objectIDs) {
        // eslint-disable-next-line no-await-in-loop
        const getResult = await searchIndexStorage.get(objectID);
        assert.strictEqual(getResult.hits[0].sourceType, 'test');
        assert.strictEqual(getResult.hits[0].contentHash, contentHash);
      }
    } finally {
      await searchIndexStorage.deleteBy('contentHash', contentHash);
    }
  }).timeout(25000);

  it('Update a content record', async () => {
    let saveResult;
    try {
      const contentRecord = generateContentRecord();
      saveResult = await searchIndexStorage.save(contentRecord);
      assert.notEqual(undefined, saveResult);
      await waitForRecord(10000);

      await searchIndexStorage.update([{ objectID: saveResult.objectID, sourceType: 'test' }]);
      await waitForRecord(10000);

      assert.ok(saveResult?.objectID);
      const { objectID } = saveResult;
      const getResult = await searchIndexStorage.get(objectID);
      assert.ok(getResult);
      assert.strictEqual(getResult.hits[0].sourceType, 'test');
    } finally {
      if (saveResult?.objectID) {
        await searchIndexStorage.delete(saveResult.objectID);
      }
    }
  }).timeout(25000);

  it('Only update a content record with allowed fields', async () => {
    let saveResult;
    try {
      const contentRecord = generateContentRecord();
      saveResult = await searchIndexStorage.save(contentRecord);
      assert.notEqual(undefined, saveResult);
      await waitForRecord(10000);

      await searchIndexStorage.update([{ objectID: saveResult.objectID, sourceType: 'test', newField: 'test' }]);
      await waitForRecord(10000);

      assert.ok(saveResult?.objectID);
      const { objectID } = saveResult;
      const getResult = await searchIndexStorage.get(objectID);
      assert.ok(getResult);
      assert.strictEqual(getResult.hits[0].sourceType, 'test');
      assert.strictEqual(getResult.hits[0].newField, undefined);
    } finally {
      if (saveResult?.objectID) {
        await searchIndexStorage.delete(saveResult.objectID);
      }
    }
  }).timeout(25000);

  it('Delete all content records of a source type', async () => {
    const sourceType = randomString(32);
    try {
      const contentRecord1 = {
        contentHash: randomString(32),
        sourceType,
      };
      const contentRecord2 = {
        contentHash: randomString(32),
        sourceType,
      };
      const saveResult1 = await searchIndexStorage.save(contentRecord1);
      const saveResult2 = await searchIndexStorage.save(contentRecord2);
      assert.notEqual(undefined, saveResult1);
      assert.notEqual(undefined, saveResult2);

      await waitForRecord(10000);

      await searchIndexStorage.deleteBy('sourceType', sourceType);
      await waitForRecord(10000);
      let res = await searchIndexStorage.get(saveResult1.objectID);
      assert.strictEqual(res.hits.length, 0);
      res = await searchIndexStorage.get(saveResult2.objectID);
      assert.strictEqual(res.hits.length, 0);
    } finally {
      await searchIndexStorage.deleteBy('sourceType', sourceType);
    }
  }).timeout(25000);

  it('Delete content records by contentHash', async () => {
    const contentHash = randomString(32);
    try {
      const contentRecord1 = {
        contentHash,
        sourceType: randomString(32),
      };
      const contentRecord2 = {
        contentHash,
        sourceType: randomString(32),
      };
      const saveResult1 = await searchIndexStorage.save(contentRecord1);
      const saveResult2 = await searchIndexStorage.save(contentRecord2);
      assert.notEqual(undefined, saveResult1);
      assert.notEqual(undefined, saveResult2);

      await waitForRecord(10000);

      await searchIndexStorage.deleteBy('contentHash', contentHash);
      await waitForRecord(10000);
      let res = await searchIndexStorage.get(saveResult1.objectID);
      assert.strictEqual(res.hits.length, 0);
      res = await searchIndexStorage.get(saveResult2.objectID);
      assert.strictEqual(res.hits.length, 0);
    } finally {
      await searchIndexStorage.deleteBy('contentHash', contentHash);
    }
  }).timeout(25000);
  it('Delete content record by objectId', async () => {
    let objectID;
    try {
      const contentRecord = {
        contentHash: randomString(32),
        sourceType: randomString(32),
      };
      const saveResult = await searchIndexStorage.save(contentRecord);
      assert.notEqual(undefined, saveResult);
      objectID = saveResult.objectID;

      await waitForRecord(10000);

      await searchIndexStorage.delete(objectID);
      await waitForRecord(10000);
      const res = await searchIndexStorage.get(objectID);
      assert.strictEqual(res.hits.length, 0);
    } finally {
      await searchIndexStorage.delete(objectID);
    }
  }).timeout(25000);
});
