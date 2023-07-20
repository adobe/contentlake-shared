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
import { BlobStorage } from '../src/index.js';
import { MockAwsClient } from './mock-aws-client.js';

describe('BlobStorage Unit Tests', () => {
  it('can get client', () => {
    const client = new BlobStorage({});
    assert.ok(client);
  });

  it('can set blob', async () => {
    const mockClient = new MockAwsClient();
    const storage = new BlobStorage({
      client: mockClient,
      bucket: 'unittest',
    });
    await storage.save('test-key', 'test-value', 'application/json');
    assert.strictEqual(mockClient.req.input.Body, 'test-value');
    assert.strictEqual(mockClient.req.input.Bucket, 'unittest');
    assert.strictEqual(mockClient.req.input.ContentType, 'application/json');
    assert.strictEqual(mockClient.req.input.Key, 'test-key');
  });

  it('can read blob as string', async () => {
    const mockClient = new MockAwsClient();
    const storage = new BlobStorage({
      client: mockClient,
      bucket: 'unittest',
    });
    const readable = new Readable();
    readable.push('Hello world');
    readable.push(null);
    mockClient.resp = {
      Body: readable,
    };
    const res = await storage.getString('test-key');
    assert.strictEqual(mockClient.req.input.Bucket, 'unittest');
    assert.strictEqual(mockClient.req.input.Key, 'test-key');
    assert.strictEqual(res, 'Hello world');
  });

  it('can get signed url', async () => {
    const mockClient = new MockAwsClient();
    const storage = new BlobStorage({
      client: mockClient,
      bucket: 'unittest',
    });
    const readable = new Readable();
    readable.push('Hello world');
    readable.push(null);
    mockClient.resp = {
      Body: readable,
    };
    const res = await storage.getString('test-key');
    assert.strictEqual(mockClient.req.input.Bucket, 'unittest');
    assert.strictEqual(mockClient.req.input.Key, 'test-key');
    assert.strictEqual(res, 'Hello world');
  });
});
