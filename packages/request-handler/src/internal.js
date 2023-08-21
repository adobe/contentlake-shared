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

import { RestError } from '@adobe/contentlake-shared-rest-error';
import { BlobStorage } from '@adobe/contentlake-shared-blob-storage';
import { QueueClient } from '@adobe/contentlake-shared-queue-client';
import { Response } from 'node-fetch';

/**
 * Internal class for handling requests
 */
export class RequestHandlerInternal {
  #context;

  #log;

  /**
   * @type {Record<string,import('./index.js').HandlerFn>}
   */
  #handlers = {};

  /**
   * @type {QueueClient}
   */
  #queueClient;

  /**
   * @param {import('@adobe/helix-universal').UniversalContext} context
   * @param {Record<string,HandlerFn>} handlers
   */
  constructor(context, handlers) {
    this.#context = context;
    this.#handlers = handlers;
    this.#log = context.log || console;

    if (context.queueClient) {
      this.#queueClient = context.queueClient;
    } else {
      const queueUrl = context.env.QUEUE_URL;
      let blobStorage;
      const queueStorageBucket = context.env.QUEUE_STORAGE_BUCKET;
      if (queueStorageBucket) {
        blobStorage = new BlobStorage({
          bucket: queueStorageBucket,
        });
      }
      this.queueClient = new QueueClient({
        queueUrl,
        blobStorage,
      });
    }
  }

  /**
   * @param {Response} res
   */
  async #serializeResponse(res) {
    let body;
    try {
      body = await res.text();
    } catch (err) {
      this.#log.warn('Failed to retrieve body', err);
    }
    return {
      body,
      status: res.status,
      headers: Object.fromEntries(res.headers),
    };
  }

  /**
   * Handles a single event
   * @param {Record<string,any>} event the event to handle
   * @returns {Promise<Response>} the response from handling the event
   */
  async #handleEvent(event) {
    const { action } = event || {};
    if (!action) {
      throw new RestError(400, 'Missing parameter [action]');
    }
    if (!this.#handlers[action]) {
      throw new RestError(400, `Invalid action [${action}]`);
    }
    return this.#handlers[action](event, this.#context);
  }

  /**
   * Handles queue records
   * @returns {Promise<Response>}
   */
  async #handleQueueRecords() {
    const records = QueueClient.extractQueueRecords(this.#context);
    this.#log.debug('Handing queue records', { count: records.length });

    const results = await Promise.allSettled(
      records.map(async (record) => {
        let res;
        try {
          this.#log.debug('Handling queue record', {
            record,
          });
          const event = await this.#queueClient.readMessageBody(record.body);
          res = await this.#handleEvent(event, this.#context);
        } catch (err) {
          this.#log.warn('Failed to handle queue record', { record, err });
          throw record.messageId;
        }
        if (res.ok) {
          this.#log.debug('Record handled successfully, removing from queue', {
            record,
          });
          await this.#queueClient.removeMessage(record.receiptHandle);
        } else {
          const serialized = this.#serializeResponse(res);
          this.#log.warn('Record handling unsuccessful', {
            record,
            response: serialized,
          });
          throw record.messageId;
        }
      }),
    );

    const batchItemFailures = results
      .filter((r) => r.status === 'rejected')
      .map((fail) => fail.reason)
      .map((itemIdentifier) => ({ itemIdentifier }));
    if (batchItemFailures.length === 0) {
      this.#log.debug('All batch items processed successfully');
      return new Response();
    } else {
      this.#log.info('Failed to process batch items', {
        total: results.length,
        failures: batchItemFailures,
        failure_count: batchItemFailures.length,
      });
      return new Response(
        JSON.stringify({
          batchItemFailures,
        }),
        { status: 206 },
      );
    }
  }

  /**
   * Handle the request
   * @returns {Promise<Response>}
   */
  async handle() {
    const { event } = this.#context.invocation;
    this.#log.debug('Handling event', event);
    if (QueueClient.isQueueRequest(this.#context)) {
      return this.#handleQueueRecords();
    } else {
      this.#log.debug('Handing POST payload');
      return this.#handleEvent(event);
    }
  }
}
