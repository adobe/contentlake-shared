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

import { FetchRetry } from '@adobe/content-lake-commons';
import { randomUUID } from 'crypto';

/**
 * @typedef {Object} IngestionRequest
 * @property {SourceData} data the data extracted from the source
 * @property {BinaryRequest} binary
 *  a description of the request to retrieve the binary for the asset
 * @property {string | undefined} batchId an identifier for the current batch
 */

/**
 * @typedef {Object} IngestionResponse
 * @property {boolean} accepted true if the asset was accepted by the ingestion service
 * @property {any} [reason] the reason the asset was not accepted
 */

/**
 * @typedef {Object} SourceData The data extracted from the source
 * @property {string} sourceAssetId the ID of this asset as interpreted by the source system
 * @property {string} sourceType the source from which this asset was retrieved
 * @property {string} sourceId the source from which this asset was retrieved
 * @property {string} [name] the name of the asset as interpreted by the source repository
 * @property {number} [size] the size of the original asset in bytes
 * @property {Date} [created] the time at which the asset was created in the source
 * @property {string} [createdBy] an identifier for the principal which created the asset
 * @property {Date} [lastModified] the last time the asset was modified
 * @property {string} [lastModifiedBy]
 *  an identifier for the principal which last modified the asset
 * @property {string} [path] the path to the asset
 * @property {string} [hash] a computed has of the binary
 * @property {BinaryRequest | undefined} [binary] If provided, information about the request
 *  that can be sent to retrieve the asset's binary data. If missing, the ingestion process will
 *  make a second call to the extractor to retrieve this information.
 */

/**
 * @typedef {Object} BinaryRequest
 *  A description of a HTTP request to make to retrieve a binary
 * @property {string} url the url to connect to in order to retrieve the binary
 * @property {Record<string,string>} [headers]
 *  headers to send with the request to retrieve the binary
 */

/**
 * @typedef IngestorConfig the configuration for the ingestor client
 * @property {string} apiKey the API Key used to call the ingestor
 * @property {string} companyId the id of the company for which this should be ingested
 * @property {string} jobId the id of the current job
 * @property {any} [log] the logger
 * @property {string} spaceId the id of the space into which this should be ingested
 * @property {string} url the URL for calling the ingestor
 */

/**
 * The ingestor client sends asset data to the Content Lake ingestion service to be ingested
 */
export class IngestorClient {
  #config;

  #client = new FetchRetry();

  #log;

  /**
   * Construct a new ingestor
   * @param {IngestorConfig} config the configuration for the ingestor
   */
  constructor(config) {
    this.#config = config;
    this.#log = config.log || console;
  }

  /**
   * Filters the data to the specified keys and then merges with the toMerge object.
   * @param {Record<string, any>} data
   * @param {Array<string>} keys
   * @param {Record<string, any>} toMerge
   */
  static #filterAndMerge(data, keys, toMerge) {
    const filtered = {};
    keys.forEach((k) => {
      filtered[k] = data[k];
    });
    return { ...filtered, ...toMerge };
  }

  /**
   * Computes the etag for the specified data or undefined if no etag can be generated
   * @param {SourceData} data The data to check
   * @returns {Promise<boolean>} if true, no further action is required by the ingestor
   */
  static computeEtag(data) {
    if (!data.hash) {
      return undefined;
    }
    const { hash } = data;
    return Buffer.from(JSON.stringify({ hash, metadata: data })).toString(
      'base64',
    );
  }

  /**
   * Checks if the ingestor already has the specified file with the same metadata and binary
   * @param {SourceData} data The data to check
   * @returns {Promise<boolean>} if true, no further action is required by the ingestor
   */
  async checkCurrent(data) {
    const start = Date.now();
    const etag = IngestorClient.computeEtag(data);
    const requestId = randomUUID();
    const { spaceId, companyId, jobId } = this.#config;

    const { sourceId, sourceAssetId } = data;

    const requestInfo = IngestorClient.#filterAndMerge(
      data,
      ['sourceAssetId', 'sourceId', 'sourceType', 'name'],
      {
        etag,
        jobId,
        companyId,
        spaceId,
        requestId,
      },
    );
    this.#log.debug('Submitting for ingestion', {
      url: this.#config.url,
      ...requestInfo,
    });

    const res = await this.#client.fetch(
      `${this.#config.url}/${sourceId}/${sourceAssetId}`,
      {
        headers: {
          'If-None-Match': etag,
          'x-api-key': this.#config.apiKey,
          'x-job-id': jobId,
          'x-request-id': requestId,
          'x-company-id': companyId,
          'x-space-id': spaceId,
        },
        method: 'HEAD',
      },
    );
    this.#log.info('Retrieved status', {
      responseStatus: res.status,
      duration: Date.now() - start,
      ...requestInfo,
    });
    switch (res.status) {
      case 200:
        this.#log.debug('Not current', requestInfo);
        return false;
      case 304:
        this.#log.debug('Current', requestInfo);
        return true;
      default:
        this.#log.debug('Invalid response status', {
          responseStatus: res.status,
          ...requestInfo,
        });
        return false;
    }
  }

  /**
   * Submits the request for ingestion
   * @param {IngestionRequest} request the request containing the data to ingest
   * @returns {Promise<IngestionResponse>} the response from the ingestion service
   */
  async submit(request) {
    const start = Date.now();
    const etag = IngestorClient.computeEtag(request.data);

    const requestId = randomUUID();
    const { spaceId, companyId, jobId } = this.#config;

    const requestInfo = IngestorClient.#filterAndMerge(
      request.data,
      ['sourceAssetId', 'sourceId', 'sourceType', 'name'],
      {
        jobId,
        etag,
        companyId,
        spaceId,
        requestId,
        batchId: request.batchId,
      },
    );

    this.#log.debug('Submitting for ingestion', {
      url: this.#config.url,
      ...requestInfo,
    });
    const res = await this.#client.fetch(this.#config.url, {
      headers: {
        'Content-Type': 'application/json',
        'If-None-Match': etag,
        'x-api-key': this.#config.apiKey,
        'x-job-id': jobId,
        'x-request-id': requestId,
        'x-company-id': companyId,
        'x-space-id': spaceId,
      },
      method: 'POST',
      body: JSON.stringify({
        ...request,
        etag,
        jobId,
        companyId,
        spaceId,
        requestId,
      }),
    });
    if (res.ok) {
      this.#log.info('Asset submitted successfully', {
        responseStatus: res.status,
        duration: Date.now() - start,
        url: this.#config.url,
        ...requestInfo,
      });
      return { accepted: true };
    } else {
      let responseBody = await res.text();
      try {
        responseBody = JSON.parse(responseBody);
      } catch (err) {
        // no need, response was not json
      }
      this.#log.warn('Failed to submit asset for ingeston', {
        responseStatus: res.status,
        responseBody,
        responseheaders: Object.fromEntries(res.headers),
        duration: Date.now() - start,
        url: this.#config.url,
        ...requestInfo,
      });
      return {
        accepted: false,
        reason: {
          responseStatus: res.status,
          responseBody,
        },
      };
    }
  }
}
