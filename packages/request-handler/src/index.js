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

import {
  BlobStorage,
  ContextHelper,
  QueueClient,
  RestError,
} from '@adobe/content-lake-commons';
import wrap from '@adobe/helix-shared-wrap';
import { helixStatus } from '@adobe/helix-status';
import { logger } from '@adobe/helix-universal-logger';
import { Response } from 'node-fetch';

/**
 * @callback HandlerFn
 * @param {Record<string,any>} event the event to handle
 * @param {import('@adobe/content-lake-commons').contextHelper.UniversalishContext} context
 *  the current context
 * @returns {Promise<Response>} the response from handling the request
 */

/**
 * A "wrapper" that handles requests from both HTTP POSTs and SQS. The service interface
 * provides capabilities that allow the Lambda function to be executed and configured
 * through HTTP requests either using POST parameters or via Queue Records
 */
export class RequestHandler {
  /**
   * @type {import("@adobe/helix-shared-wrap").WrapFunction | undefined}
   */
  #wrapFn;

  /**
   * @type {HandlerFn}
   */
  #handlers = {};

  /**
   * Registers an action handler, replacing the existing handler (if any)
   * @param {string} action the action name
   * @param {function(any):Promise<Response>} handler the handler function
   * @returns {RequestHandler}
   */
  withHandler(action, handler) {
    this.#handlers[action] = handler;
    return this;
  }

  /**
   * Gets the main function for the extractor
   * @returns {function(Request,UniversalContext):Promise<Response>} the main function
   */
  getMain() {
    let main = wrap(async (request, context) => {
      const helper = new ContextHelper(context);
      const log = helper.getLog();
      let res;
      const { method, url } = request;
      const loggableRequest = {
        method,
        url,
        headers: Object.fromEntries(request.headers),
        invocation: context?.invocation,
        event: helper.extractOriginalEvent(),
      };
      const start = Date.now();
      try {
        log.debug(`> ${method} ${url}`);
        log.debug('Handling request', loggableRequest);
        res = await this.handleRequest(context);
      } catch (err) {
        log.warn('Exception handling request', { ...loggableRequest, err });
        res = RestError.toProblemResponse(err);
      }
      log.info(`< ${method} ${res.status} ${url} ${Date.now() - start}ms`);
      return res;
    });
    if (this.#wrapFn) {
      main = main.with(this.#wrapFn);
    }
    return main.with(helixStatus).with(logger.trace).with(logger);
  }

  /**
   * Get the queue client for the specified request
   * @param {any} context  Context for the current execution is running.
   * @returns {QueueClient} the queue client
   */
  // eslint-disable-next-line class-methods-use-this
  getQueueClient(context) {
    const helper = new ContextHelper(context);
    const queueUrl = context.env.QUEUE_URL;
    if (!queueUrl) {
      throw new Error('Missing ENV variable QUEUE_URL');
    }
    let blobStorage;
    const queueStorageBucket = context.env.QUEUE_STORAGE_BUCKET;
    if (queueStorageBucket) {
      blobStorage = new BlobStorage({
        ...helper.extractAwsConfig(context),
        bucket: queueStorageBucket,
      });
    }
    return new QueueClient({
      ...helper.extractAwsConfig(context),
      queueUrl,
      blobStorage,
    });
  }

  /**
   * Handles a request that comes into an extractor's HTTP service.
   * @param {any} context Context for the current execution is running.
   * @returns {Promise<Response>} Resolves with the response that the service
   *  will provide
   */
  async handleRequest(context) {
    const helper = new ContextHelper(context);
    const log = helper.getLog();

    if (helper.isQueueRequest()) {
      const queueClient = this.getQueueClient(context);
      const records = helper.extractQueueRecords();
      log.debug('Handing queue records', { count: records.length });

      const results = await Promise.allSettled(
        records.map((qr) => this.handleQueueRecord(context, qr, queueClient, log)),
      );

      const batchItemFailures = results
        .filter((r) => r.status === 'rejected')
        .map((fail) => fail.reason)
        .map((itemIdentifier) => ({ itemIdentifier }));
      if (batchItemFailures.length === 0) {
        log.debug('All batch items processed successfully');
        return new Response();
      } else {
        log.info('Failed to process batch items', {
          items: batchItemFailures,
          count: batchItemFailures.length,
        });
        return new Response(
          JSON.stringify({
            batchItemFailures,
          }),
          { status: 206 },
        );
      }
    } else {
      log.debug('Handing POST payload');
      const event = helper.extractOriginalEvent();
      return this.handleEvent(event, context);
    }
  }

  /**
   * Handles a single event
   * @param {Record<string,any>} event the event to handle
   * @param {import('@adobe/content-lake-commons').contextHelper.UniversalishContext} context
   *  the current context
   * @returns {Promise<Response>} the response from handling the event
   */
  async handleEvent(event, context) {
    const { action } = event || {};
    if (!action) {
      throw new RestError(400, 'Missing parameter [action]');
    }
    if (!this.#handlers[action]) {
      throw new RestError(400, `Invalid action [${action}]`);
    }
    return this.#handlers[action](event, context);
  }

  /**
   * Handles a queue event record
   * @param {import('@adobe/content-lake-commons').contextHelper.UniversalishContext} context
   * @param {import('@adobe/content-lake-commons').QueueRecord} record
   * @param {QueueClient} queueClient
   * @param {import('@adobe/content-lake-commons').contextHelper.Logger} log
   * @returns {Promise<void>}
   */
  async handleQueueRecord(context, record, queueClient, log) {
    try {
      log.debug('Handling queue record', {
        record,
      });
      const event = await queueClient.readMessageBody(record.body);
      const res = await this.handleEvent(event, context);
      if (res.ok) {
        log.debug('Record handled successfully, removing from queue', {
          record,
        });
        await queueClient.removeMessage(record.receiptHandle);
      } else {
        log.warn('Record handling unsuccessful', {
          record,
          res,
        });
        throw record.messageId;
      }
    } catch (err) {
      log.warn('Failed to handle queue record', { record, err });
      throw record.messageId;
    }
  }

  /**
   * Adds an additional wrap function to the invocation
   * @param {import("@adobe/helix-shared-wrap").WrapFunction} fn
   */
  withWrapFunction(fn) {
    this.#wrapFn = fn;
    return this;
  }
}
