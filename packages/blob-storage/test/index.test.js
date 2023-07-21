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

/* eslint-env mocha */
import assert from 'assert';
import { Readable } from 'stream';
import { mockClient } from 'aws-sdk-client-mock';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { BlobStorage } from '../src/index.js';

const mockS3Client = mockClient(S3Client);

describe('BlobStorage Unit Tests', () => {
  const storage = new BlobStorage({
    client: mockS3Client,
    bucket: 'unittest',
  });
  afterEach(() => mockS3Client.reset());
  it('can get client', () => {
    const client = new BlobStorage({});
    assert.ok(client);
  });

  it('can set blob', async () => {
    await storage.save('test-key', 'test-value', 'application/json');
    assert.strictEqual(mockS3Client.calls().length, 1);
    const call = mockS3Client.call(0);
    const command = call.args[0];
    assert.strictEqual(command.input.Body, 'test-value');
    assert.strictEqual(command.input.Bucket, 'unittest');
    assert.strictEqual(command.input.ContentType, 'application/json');
    assert.strictEqual(command.input.Key, 'test-key');
  });

  it('can read blob as string', async () => {
    const readable = new Readable();
    readable.push('Hello world');
    readable.push(null);
    mockS3Client.on(GetObjectCommand).resolves({
      Body: readable,
    });
    const res = await storage.getString('test-key');
    assert.strictEqual(res, 'Hello world');

    const call = mockS3Client.call(0);
    const command = call.args[0];
    assert.strictEqual(command.input.Bucket, 'unittest');
    assert.strictEqual(command.input.Key, 'test-key');
  });

  describe('list', () => {
    function mockListResponse(cursor, more, contentCount) {
      const Contents = [];
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < contentCount; i++) {
        Contents.push({
          Key: `item${i}`,
          Owner: `owner${i}`,
          ETag: `etag${i}`,
          LastModified: `lastModified${i}`,
          Size: i,
        });
      }
      return {
        NextContinuationToken: cursor,
        IsTruncated: more,
        Contents,
      };
    }

    it('list blobs', async () => {
      mockS3Client
        .on(ListObjectsV2Command)
        .resolves(mockListResponse('test-cursor', false, 3));
      const blobs = await storage.list();
      assert.deepStrictEqual(blobs, {
        cursor: 'test-cursor',
        hasMore: false,
        blobs: [
          {
            key: 'item0',
            owner: 'owner0',
            etag: 'etag0',
            lastModified: 'lastModified0',
            size: 0,
          },
          {
            key: 'item1',
            owner: 'owner1',
            etag: 'etag1',
            lastModified: 'lastModified1',
            size: 1,
          },
          {
            key: 'item2',
            owner: 'owner2',
            etag: 'etag2',
            lastModified: 'lastModified2',
            size: 2,
          },
        ],
      });

      const call = mockS3Client.call(0);
      const command = call.args[0];
      assert.strictEqual(command.input.Bucket, 'unittest');
      assert.ok(!command.input.ContinuationToken);
      assert.ok(!command.input.Prefix);
    });

    it('list blobs with empty object', async () => {
      mockS3Client
        .on(ListObjectsV2Command)
        .resolves(mockListResponse('test-cursor', false, 1));
      const blobs = await storage.list({});
      assert.ok(blobs);

      const call = mockS3Client.call(0);
      const command = call.args[0];
      assert.strictEqual(command.input.Bucket, 'unittest');
      assert.ok(!command.input.ContinuationToken);
      assert.ok(!command.input.Prefix);
    });

    it('list blobs with prefix', async () => {
      mockS3Client
        .on(ListObjectsV2Command)
        .resolves(mockListResponse('test-cursor', false, 1));
      const blobs = await storage.list({ prefix: 'test-prefix' });
      assert.ok(blobs);

      const call = mockS3Client.call(0);
      const command = call.args[0];
      assert.strictEqual(command.input.Bucket, 'unittest');
      assert.ok(!command.input.ContinuationToken);
      assert.strictEqual(command.input.Prefix, 'test-prefix');
    });

    it('list blobs with cursor', async () => {
      mockS3Client
        .on(ListObjectsV2Command)
        .resolves(mockListResponse('test-cursor', false, 1));
      const blobs = await storage.list({ cursor: 'test-cursor' });
      assert.ok(blobs);

      const call = mockS3Client.call(0);
      const command = call.args[0];
      assert.strictEqual(command.input.Bucket, 'unittest');
      assert.strictEqual(command.input.ContinuationToken, 'test-cursor');
      assert.ok(!command.input.Prefix);
    });

    it('handles no continuation token', async () => {
      mockS3Client
        .on(ListObjectsV2Command)
        .resolves(mockListResponse('test-cursor', false, 1));
      const blobs = await storage.list({ cursor: 'test-cursor' });
      assert.ok(blobs);

      const call = mockS3Client.call(0);
      const command = call.args[0];
      assert.strictEqual(command.input.Bucket, 'unittest');
      assert.strictEqual(command.input.ContinuationToken, 'test-cursor');
      assert.ok(!command.input.Prefix);
    });
  });
});
