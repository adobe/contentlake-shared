/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-disable import/no-extraneous-dependencies */
/* eslint-env mocha */
import { S3 } from '@aws-sdk/client-s3';
import assert from 'assert';
import { config } from 'dotenv';
import https from 'https';
import { randomBytes } from 'crypto';
import { ContextHelper } from '@adobe/content-lake-commons';
import { BlobStorage } from '../src/index.js';

config();

const BUCKET = 'cl-commons-it-files';
const TEST_BLOB_ID = 'test-blob.txt';
const TEST_UPLOAD_BLOB_ID = 'test-upload-blob.webp';
const DEFAULT_CONFIG = { ...(new ContextHelper(process).extractAwsConfig()), bucket: BUCKET };
const SIGNED_URI_TTL = 60 * 15;

/**
 * Upload "size" bytes from the provided "buffer" to "uri".
 *
 * Useful for uploading to signed PUT uris.
 *
 * @param {string} uri
 * @param {string} buffer
 * @param {int} size
 * @param {string} contentType
 * @returns {Promise<string>} containing the HTTP response
 */
async function uploadBytes(uri, buffer, size, contentType = 'application/octet-stream') {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': size,
      },
    };
    const req = https.request(uri, uploadOptions, (res) => {
      let response = '';
      res.on('data', (chunk) => {
        response += chunk;
      });
      res.on('end', () => {
        resolve(response);
      });
      assert.strictEqual(
        200,
        res.statusCode,
        `Expected 201 status but got ${res.statusCode}`,
      );
    }).on('error', (e) => {
      reject(e);
    });

    req.write(buffer);
    req.end();
  });
}

describe('Cloud Blob Storage integration tests', () => {
  let s3;
  before(async () => {
    s3 = new S3(DEFAULT_CONFIG);
    // ensure that the test bucket exists.
    try {
      await s3.headBucket({
        Bucket: BUCKET,
      });
      await s3.headObject({
        Bucket: BUCKET,
        Key: TEST_BLOB_ID,
      });
    } catch (error) {
      assert.fail(`IT Bucket doesn't exist: ${error.message}`);
    }
  });

  afterEach(async () => {
    // clean up all spurious blobs
    s3 = new S3(DEFAULT_CONFIG);
    try {
      const data = await s3.listObjects({
        Bucket: BUCKET,
      });
      const jobs = [];
      for (const entry of data.Contents) {
        if (TEST_BLOB_ID !== entry?.Key) {
          jobs.push(
            s3.deleteObject({
              Bucket: BUCKET,
              Key: entry.Key,
            }),
          );
        }
      }
      Promise.all(jobs);
    } catch (error) {
      assert.fail(error);
    }
  });

  it('Can save to blob storage', async () => {
    const blobStorage = new BlobStorage(DEFAULT_CONFIG);
    const KEY = 'save-to-blob-storage.txt';

    await blobStorage.save(KEY, Buffer.from('Hello World'), 'text/plain');
    try {
      await s3.headObject({
        Bucket: BUCKET,
        Key: KEY,
      });
    } catch (error) {
      assert.fail(error);
    }
  });

  it('Can save to blob storage without mediaType', async () => {
    const blobStorage = new BlobStorage(DEFAULT_CONFIG);
    const KEY = 'save-to-blob-storage-no-mimetype.txt';
    await blobStorage.save(KEY, Buffer.from('Hello World'));
    try {
      await s3.headObject({
        Bucket: BUCKET,
        Key: KEY,
      });
    } catch (error) {
      assert.fail(error);
    }
  });

  it('Can get blob as string', async () => {
    const blobStorage = new BlobStorage(DEFAULT_CONFIG);
    const body = await blobStorage.getString(TEST_BLOB_ID);
    assert.strictEqual(body.trim(), 'Test Blob');
  });

  it('Generate signed GET URI generates valid signed URI for correct blob', async () => {
    const blobStorage = new BlobStorage(DEFAULT_CONFIG);
    const uri = await blobStorage.getSignedURI(TEST_BLOB_ID);
    https
      .get(uri, (res) => {
        assert.strictEqual(
          200,
          res.statusCode,
          `Expected 200 status but got ${res.statusCode}`,
        );
      })
      .on('error', (e) => {
        assert.fail(e);
      });
  });

  it('Generate signed URI fails if blob does not exist for key', async () => {
    const blobStorage = new BlobStorage(DEFAULT_CONFIG);
    assert.rejects(() => {
      blobStorage.getSignedURI('invalidKey');
    });
  });

  it('Generate signed PUT URI generates a single valid signed URI for uploading', async () => {
    const blobStorage = new BlobStorage(DEFAULT_CONFIG);
    const uri = await blobStorage.getSignedPutURI(TEST_UPLOAD_BLOB_ID, SIGNED_URI_TTL);
    assert.ok(uri);

    const srcBlob = randomBytes(2048);

    try {
      await uploadBytes(uri, srcBlob, 2048, 'image/webp');

      const readBlob = await blobStorage.getString(TEST_UPLOAD_BLOB_ID);
      assert.strictEqual(readBlob, srcBlob.toString('utf-8'));
    } finally {
      await blobStorage.delete(TEST_UPLOAD_BLOB_ID);
    }
  }).timeout(5000);
});
