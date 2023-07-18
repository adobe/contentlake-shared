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
/* eslint-disable lines-between-class-members */
/* eslint-disable class-methods-use-this */
import algoliasearch from 'algoliasearch';
import crypto from 'crypto';
import clone from 'clone';
import { ContextHelper } from '@adobe/content-lake-commons';

export class SearchIndex {
  #FIELDS_TO_INDEX = new Set([
    'objectID',
    'assetIdentity',
    'contentHash',
    'sourceName',
    'sourceType',
    'thumbnailHash',
    'file',
    'companyId',
    'spaceId',
    'type',
    'tags',
    'caption',
    'ocrTags',
    'width',
    'height',
    'date',
    'color',
    'sourceId',
    'sourceUrl',
    'sourceAssetId',
    'sourcePath',
    'assetStatus',
    'sourceMimeType',
    'sourceSize',
    'sourceWidth',
    'sourceHeight',
    'c2paLevel',
  ]);
  #INDEX_PREFIX = 'company-details';
  #log;
  index;
  #indexName;

  constructor(context, companyId) {
    this.#indexName = context.env.ALGOLIA_CI_INDEX || `${this.#INDEX_PREFIX}-${companyId}`;
    this.#log = new ContextHelper(context).getLog();
    this.#log.info('Using Search Index', this.#indexName);

    this.index = this.getClient(context).initIndex(this.#indexName);
  }

  getIndexName() {
    return this.#indexName;
  }

  getClient(context) {
    return algoliasearch(
      context.env.ALGOLIA_APP_NAME,
      context.env.ALGOLIA_API_KEY,
    );
  }

  /**
   * Strong Existence Check
   *
   * Needs to have both the sourceId and the contentHash (source binary hash) matching
   * @param {Object} query
   * @returns {Promise<any[] | false>} Object of hits if there is a hit or false if it doesn't exist
   */
  async exists(query) {
    // if no contentHash, we don't want to match just on the sourceId
    // because that is not reliable so we will not return a match
    if (!query?.contentHash) {
      this.#log.info(
        'Missing query.contentHash, no existence in the record storage.',
      );
      return false;
    }
    const searchResult = await this.find(query);
    return searchResult || false;
  }

  /**
   * Searches the index for documents matching the specified query values
   *
   * @param {Record<string,any>} query the query by which to search
   * @returns {Promise<Array<any>>} the results from the query
   */
  async find(query) {
    const facetFilters = Object.keys(query).map(
      (key) => `${key}:${query[key]}`,
    );
    const searchResult = await this.index.search('', {
      facetFilters,
    });
    if (searchResult?.hits?.length === 0) {
      return false;
    }
    return searchResult?.hits;
  }

  /**
   * Retrieve a single index record via the record's identifier (objectID).
   * @param {String} objectID - the unique identifier for the index record
   * @returns the raw result of the query; will contain the record if it exists.
   */
  async get(objectID) {
    return this.index.search(
      '',
      {
        facetFilters: [
          `objectID:${objectID}`,
        ],
      },
    );
  }

  /**
   * Save the information in the provided object to the search index as an index record.
   *
   * Not all fields provided in the object will be saved to the index. This method takes the values
   * from the provided object that are specified to be used in the index and saves a record with
   * those values; other values are ignored.
   * @param {Object} doc the object to store in the index.
   * @returns An object containing the saved record's ObjectID.
   */
  async save(doc) {
    const indexRecord = Object.keys(doc).reduce((obj, key) => {
      const result = clone(obj);
      if (this.#FIELDS_TO_INDEX.has(key)) {
        result[key] = doc[key];
      }
      return result;
    }, {});
    if (!indexRecord?.objectID) {
      indexRecord.objectID = crypto.randomUUID();
      this.#log.warn(`Missing objectID, generating a new one: ${indexRecord.objectID}`);
    }

    this.#log.info(`Saving doc to cloud record storage index ${this.#indexName}`, indexRecord);
    return this.index.saveObject(indexRecord);
  }

  /**
   * Get a list of ObjectID that contain the contentHash
   * @param {String} contentHash sha256 hash of the source binary
   * @returns {Promise<Array<string>>} list of objectIDs
   */
  async getObjectIdsByContentHash(contentHash) {
    return this.getObjectIdsBy('contentHash', contentHash);
  }

  /**
   * Get a list of ObjectIDs that contain the key,value pair
   * Ex: `getObjectIdsBy('sourceType', 's3')` will get all records with `sourceType` of `s3`
   *
   * @param {String} key attribute to get by.
   * @param {String} value value of the attribute to get by.
   */
  async getObjectIdsBy(key, value) {
    const hits = await this.getObjectsBy(key, value);
    if (hits.length > 0) {
      return hits.map((hit) => hit.objectID);
    }
    return [];
  }
  /**
   * Get a list of ObjectIDs that contain the key,value pair
   * Ex: `getObjectIdsBy('sourceType', 's3')` will get all records with `sourceType` of `s3`
   *
   * @param {String} key attribute to get by.
   * @param {String} value value of the attribute to get by.
   * @param {Boolean} distinct whether to return distinct values or not
   */
  async getObjectsBy(key, value, distinct = true) {
    const searchResult = await this.index.search(
      '',
      {
        distinct,
        facetFilters: [
          `${key}:${value}`,
        ],
      },
    );
    if (searchResult?.nbHits > 0) {
      return searchResult?.hits;
    }
    return [];
  }

  /**
   * Update all records in the index containing the contentHash
   *
   * - Only update the values that are provided in the object (partial update)
   * - Only add fields that are able to be indexed: `this.#FIELDS_TO_INDEX`
   * @param {Object} doc document containing the contentHash and other fields to update
   */
  // eslint-disable-next-line consistent-return
  async updateByContentHash(doc) {
    if (!doc?.contentHash) {
      const message = 'Missing contentHash, no update in the record storage.';
      this.#log.error(message);
      throw new Error(message);
    }
    let objectIDs = await this.getObjectIdsByContentHash(doc.contentHash);
    if (objectIDs.length > 0) {
      objectIDs = objectIDs.map((objectID) => ({ objectID, ...doc }));
      return this.update(objectIDs);
    }
    this.#log.info('No matching record found in the record storage.');
    // return empty object in this case to mtach the return type of update()
    // https://www.algolia.com/doc/api-reference/api-methods/partial-update-objects/#response
    return {};
  }

  /**
   * Update records in a index
   * Only update the values that are provided in the object (partial update):
   * https://www.algolia.com/doc/api-reference/api-methods/partial-update-objects/
   * @param {Array<Object>} records Array of content records with fields to update
   * @returns {Promise<Object>} Algolia response including objectIDs of updated records and a taskID
   */
  async update(records) {
    const indexRecords = records.map((doc) => {
      const indexRecord = Object.keys(doc).reduce((obj, key) => {
        const result = clone(obj);
        if (this.#FIELDS_TO_INDEX.has(key)) {
          result[key] = doc[key];
        }
        return result;
      }, {});
      return indexRecord;
    });
    this.#log.info(`Updating docs ${indexRecords.length} records in cloud record storage index ${this.indexName}`);
    this.#log.debug('Documents updated:', indexRecords);
    return this.index.partialUpdateObjects(indexRecords);
  }

  /**
   * Delete record from index
   * @param {String} objectID unique identifier for the index record
   * @returns {Promise<any>}
   */
  async delete(objectID) {
    return this.index.deleteObject(objectID);
  }

  /**
   * Delete all records of type `key` with value `value` from index
   * `key` must be enabled as a filterable attribute in the index.
   *
   * Ex: `deleteBy('sourceType', 's3')` will delete all records with `sourceType` of `s3`
   *
   * @param {String} key attribute to delete by.
   * @param {String} value value of the attribute to delete by.
   * @param {Object} options request options to pass to the deleteBy method
   */
  async deleteBy(key, value, options) {
    this.#log.info(`Deleting all records with '${key}' containing value ${value}`);
    const params = {
      filters: `${key}:${value}`,
    };
    return this.index.deleteBy(params, options);
  }
}
