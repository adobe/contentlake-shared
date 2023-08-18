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
import { stub } from 'sinon';
import { MockAlgoliaSearch } from './mocks/mock-algoliasearch.js';
import { SearchIndex } from '../src/index.js';

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
    randomField: 'randomValue',
  };
}

function mockContext() {
  return {
    env: {
      ALGOLIA_APP_NAME: 'appname',
      ALGOLIA_API_KEY: 'apikey',
      ALGOLIA_CI_INDEX: 'indexname',
    },
    log: console,
  };
}

let searchIndexStorage;
describe('Search Index tests', async () => {
  before(() => {
    stub(SearchIndex.prototype, 'getClient').returns(new MockAlgoliaSearch());
    searchIndexStorage = new SearchIndex(mockContext());
  });
  after(() => {
    try {
      SearchIndex.prototype.getClient.restore();
    } catch (error) {
      // ignore
    }
  });
  it('Use company name as the index name: `company-*`', async () => {
    // don't use mocked client for this test
    SearchIndex.prototype.getClient.restore();
    const context = {
      env: {
        ALGOLIA_APP_NAME: 'appname',
        ALGOLIA_API_KEY: 'apikey',
      },
      log: console,
    };
    const searchIndexStorage2 = new SearchIndex(context, 'test-company-id');
    assert.strictEqual(searchIndexStorage2.getIndexName(), 'company-details-test-company-id');
    stub(SearchIndex.prototype, 'getClient').returns(new MockAlgoliaSearch());
  });

  it('check if item exists requires a contentHash', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const exists = await searchIndexStorage.exists({
      sourceAssetId: contentRecord.sourceAssetId,
    });
    assert.ok(!exists);
  });
  it('Save a record in cloud search index storage and check it exists', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const exists = await searchIndexStorage.exists({
      contentHash: contentRecord.contentHash,
      sourceAssetId: contentRecord.sourceAssetId,
    });
    assert.strictEqual(exists.length, 1);
    assert.strictEqual(exists[0].contentHash, contentRecord.contentHash);
    assert.strictEqual(exists[0].thumbnailHash, contentRecord.thumbnailHash);
    assert.strictEqual(exists[0].sourceId, contentRecord.sourceId);
    assert.strictEqual(exists[0].sourceAssetId, contentRecord.sourceAssetId);
    assert.strictEqual(exists[0].sourceName, contentRecord.sourceName);
    assert.strictEqual(exists[0].sourcePath, contentRecord.sourcePath);
    assert.strictEqual(exists[0].file, contentRecord.file);
    assert.strictEqual(exists[0].type, contentRecord.type);
    assert.strictEqual(exists[0].width, contentRecord.width);
    assert.strictEqual(exists[0].height, contentRecord.height);
    assert.strictEqual(exists[0].sourceType, contentRecord.sourceType);
    assert.strictEqual(exists[0].companyId, contentRecord.companyId);
    assert.strictEqual(exists[0].spaceId, contentRecord.spaceId);
    assert.strictEqual(exists[0].assetIdentity, contentRecord.assetIdentity);
    assert.deepStrictEqual(exists[0].tags, contentRecord.tags);
    assert.strictEqual(exists[0].caption, contentRecord.caption);
    assert.strictEqual(exists[0].color, contentRecord.color);
    assert.strictEqual(exists[0].sourceUrl, contentRecord.sourceUrl);
    assert.ok(exists[0].objectID);
    assert.ok(!exists[0].randomField);
  });
  it('Save a record in cloud search index storage and get the object', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const { hits } = await searchIndexStorage.get(saveResult.objectID);
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].contentHash, contentRecord.contentHash);
    assert.strictEqual(hits[0].thumbnailHash, contentRecord.thumbnailHash);
    assert.strictEqual(hits[0].sourceId, contentRecord.sourceId);
    assert.strictEqual(hits[0].sourceAssetId, contentRecord.sourceAssetId);
    assert.strictEqual(hits[0].sourceName, contentRecord.sourceName);
    assert.strictEqual(hits[0].sourcePath, contentRecord.sourcePath);
    assert.strictEqual(hits[0].file, contentRecord.file);
    assert.strictEqual(hits[0].type, contentRecord.type);
    assert.strictEqual(hits[0].width, contentRecord.width);
    assert.strictEqual(hits[0].height, contentRecord.height);
    assert.strictEqual(hits[0].sourceType, contentRecord.sourceType);
    assert.strictEqual(hits[0].companyId, contentRecord.companyId);
    assert.strictEqual(hits[0].spaceId, contentRecord.spaceId);
    assert.strictEqual(hits[0].assetIdentity, contentRecord.assetIdentity);
    assert.deepStrictEqual(hits[0].tags, contentRecord.tags);
    assert.strictEqual(hits[0].caption, contentRecord.caption);
    assert.strictEqual(hits[0].color, contentRecord.color);
    assert.strictEqual(hits[0].sourceUrl, contentRecord.sourceUrl);
    assert.strictEqual(hits[0].objectID, saveResult.objectID);
    assert.ok(!hits[0].randomField);
  });

  it('Get all objects by key value pair', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const objects = await searchIndexStorage.getObjectsBy('sourceId', contentRecord.sourceId);
    assert.strictEqual(objects.length, 1);
    assert.deepStrictEqual(objects[0], saveResult);
  });
  it('Get all objectIDs by key value pair', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const objects = await searchIndexStorage.getObjectIdsBy('sourceId', contentRecord.sourceId);
    assert.strictEqual(objects.length, 1);
    assert.deepStrictEqual(objects[0], saveResult.objectID);
  });
  it('Get all objectIDs by contentHash', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const objectIds = await searchIndexStorage.getObjectIdsByContentHash(contentRecord.contentHash);
    assert.strictEqual(objectIds.length, 1);
    assert.strictEqual(objectIds[0], saveResult.objectID);
  });
  it('Should not get results getting all objectIDs by an invalid contentHash', async () => {
    const objectIds = await searchIndexStorage.getObjectIdsByContentHash('invalid');
    assert.strictEqual(objectIds.length, 0);
  });

  it('Update all content records that contain a contentHash', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const updateResult = await searchIndexStorage.updateByContentHash({
      sourceId: 'random',
      contentHash: contentRecord.contentHash,
    });
    // mocked response from mocked algolia client
    assert.strictEqual(updateResult.length, 1);
    assert.strictEqual(updateResult[0].sourceId, 'random');
  });
  it('Cannot update all content records that contain a contentHash without a contentHash', async () => {
    try {
      await searchIndexStorage.updateByContentHash({
        sourceId: 'random',
      });
      assert.fail('Should have failed');
    } catch (error) {
      assert.strictEqual(error.message, 'Missing contentHash, no update in the record storage.');
    }
  });
  it('Cannot update all content records that contain a contentHash without a contentHash that exists.', async () => {
    const res = await searchIndexStorage.updateByContentHash({
      sourceId: 'random',
      contentHash: 'invalid',
    });
    assert.deepStrictEqual(res, {});
  });

  it('Delete content records by objectId', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const exists = await searchIndexStorage.exists({
      contentHash: contentRecord.contentHash,
      sourceAssetId: contentRecord.sourceAssetId,
    });
    assert.strictEqual(exists.length, 1);

    await searchIndexStorage.delete(saveResult.objectID);
    const existsNow = await searchIndexStorage.exists({
      contentHash: contentRecord.contentHash,
      sourceAssetId: contentRecord.sourceAssetId,
    });
    assert.ok(!existsNow);
  });

  it('delete all content hashes', async () => {
    const contentRecord = generateContentRecord();
    const saveResult = await searchIndexStorage.save(contentRecord);
    assert.notEqual(undefined, saveResult);

    const deleteByParams = await searchIndexStorage.deleteBy('contentHash', contentRecord.contentHash);
    assert.deepStrictEqual(deleteByParams, { filters: `contentHash:${contentRecord.contentHash}` });
  });

  it('copy index works', async () => {
    const copyResult = await searchIndexStorage.copyIndex('test-index', []);
    assert.equal('mockedTaskId', copyResult.taskID);
  });

  it('copy index  with scop works', async () => {
    const copyResult = await searchIndexStorage.copyIndex('test-index', [
      'settings',
    ]);
    assert.equal('mockedTaskId', copyResult.taskID);
  });

  it('copy index settings works', async () => {
    const copyResult = await searchIndexStorage.copySettings('test-index');
    assert.equal(undefined, copyResult);
  });

  it('move index works', async () => {
    const moveResult = await searchIndexStorage.moveIndex('test-index');
    assert.equal('mockedTaskId', moveResult.taskID);
  });

  it('wait tasks works', async () => {
    const waitResult = await searchIndexStorage.waitTask('task-id');
    assert.equal(undefined, waitResult);
  });
});
