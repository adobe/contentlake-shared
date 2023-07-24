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
/* eslint-disable class-methods-use-this */
import { Readable } from 'stream';

export class MockBlobStorage {
  blobs = {};

  lists = [];

  static mockListResponse(cursor, hasMore, count) {
    const blobs = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < count; i++) {
      blobs.push({
        key: `item${i}`,
        etag: `etag${i}`,
        lastModified: `lastModified${i}`,
        size: i,
        body: `body${i}`,
      });
    }
    return {
      cursor,
      hasMore,
      blobs,
    };
  }

  /**
   * Return the binary for a blob
   * @param {string} key - identifier of the blob
   * @returns {Promise<import('stream').Readable>}
   */
  async get(key) {
    const body = this.blobs[key]?.body;
    if (body) {
      const s = new Readable();
      s.push(body);
      s.push(null);
      return s;
    }
    return undefined;
  }

  /**
   * Return a signed URI for reading the blob specified by 'key' that expires after the
   * specified TTL; default is one hour.
   * @param {string} key - identifier of the blob.
   * @param {number} expirationInSeconds
   * @returns {Promise<string>}
   */
  async getSignedURI(key) {
    return `http://signed.uri.com/${key}`;
  }

  /**
   * Return a signed URI for writing a blob specified by 'key' that expires after the
   * specified TTL; default is one hour.
   * @param {string} key - identifier of the blob.
   * @param {number} expirationInSeconds
   * @returns {Promise<string>}
   */
  async getSignedPutURI(key) {
    return `http://signed.put.uri.com/${key}`;
  }

  /**
   * Return the binary for a blob
   * @param {string} key - identifier of the blob
   * @returns {Promise<string>}
   */
  async getString(key) {
    return this.blobs[key]?.body;
  }

  /**
   * Lists the blobs in the container with an optional prefix and cursor
   * @param {Object|undefined} config
   * @param {string|undefined} config.cursor
   * @param {string|undefined} config.prefix
   * @return {Promise<ListResponse>}
   */
  async list() {
    return this.lists.shift();
  }

  /**
   * Saves the provided body to blob storage
   * @param {string} key
   * @param {ReadableStream | Buffer} body
   * @param {string} [mediaType]
   * @returns {Promise<void>}
   */
  async save(key, body) {
    this.blobs[key].Body = body;
  }

  /**
   * Deletes the object specified by the provided key
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(key) {
    delete this.blobs[key];
  }
}
