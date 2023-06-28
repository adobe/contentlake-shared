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

/* eslint-disable max-classes-per-file */
import { eachLimit } from 'async';

/**
 * @typedef BatchResult
 * @property {number} duration
 * @property {Array<ErrorItem>} errors
 * @property {number} processed
 * @property {number} [traversed]
 */

/**
 * @typedef ErrorItem
 * @property {string} method
 * @property {any} node
 * @property {Error|Object} error
 */

/**
 * @typedef BatchConfig
 * @property {any} log
 * @property {number} [processLimit] the concurrency limit for process executions
 * @property {number} [traversalLimit] the concurrency limit for traversal executions
 * @property {number} [waitDuration] the duration to wait if the processing queue is empty
 */

/**
 * @typedef ExecutionState
 * @property {Array<ErrorItem>} [errors] errors during processing and traversing
 * @property {number} [processed] the number of items already processed
 * @property {Array<any>} [processingBatch] the items which are currently being processed
 * @property {Array<any>} [processingQueue] the queue of items to process
 * @property {number} [traversed] the items already traversed
 * @property {Array<any>} [traversalBatch] the items currently being traversed
 * @property {Array<any>} [traversalQueue] the items which are queued to be traversed
 */

const DEFAULT_LIMIT = 1;

/**
 * This class supports processing items in batches while limiting concurrency to avoid
 * denial requests from downstream systems supporting both cursor-based and tree-based
 * traversals as well as direct batch processing.
 *
 * It utilizes two queues to control the processing. The traversal queue manages the
 * items which should be checked for additional derived batches or if they should be processed.
 * The processing queue manages the items which should be processed.
 *
 * This library uses async's eachLimit to execute the functions asynchronously while
 * limiting concurrency.
 */
export class BatchExecutor {
  /**
   * @type {BatchConfig}
   */
  #config;

  #log;

  #processingBatch;

  /**
   * @type {import('./batch-provider.js').BaseBatchProvider}
   */
  #provider;

  #traversalBatch;

  #errors = [];

  #moreNodes = false;

  #running = false;

  #processed = 0;

  #processingQueue = [];

  #traversed = 0;

  #traversalQueue = [];

  /**
   * @param {BaseBatchProvider} provider
   * @param {BatchConfig} [config]
   */
  constructor(provider, config) {
    if (!provider) {
      throw new Error('Batch provider required');
    }
    this.#provider = provider;
    this.#config = {
      waitDuration: 100,
      ...(config || {}),
    };
    this.#log = config?.log || console;
  }

  /**
   * Gets the current state
   * @returns {ExecutionState}
   */
  getState() {
    return {
      errors: this.#errors,
      processed: this.#processed,
      processingBatch: this.#processingBatch,
      processingQueue: this.#processingQueue,
      traversed: this.#traversed,
      traversalBatch: this.#traversalBatch,
      traversalQueue: this.#traversalQueue,
    };
  }

  /**
   *
   * @param {ExecutionState} state
   */
  setState(state) {
    this.#errors = state.errors || [];
    this.#processed = state.processed || 0;
    this.#processingQueue = state.processingQueue || [];
    this.#traversed = state.traversed || 0;
    this.#traversalQueue = state.traversalQueue || [];
    this.#processingBatch = state.processingBatch || [];
    this.#traversalBatch = state.traversalBatch || [];
  }

  /**
   * Processes the requested items
   * @param {Array<any>} [toProcess]
   * @returns {Promise<BatchResult>}
   */
  async processItems(toProcess) {
    const start = Date.now();
    this.#running = true;
    this.#moreNodes = false;
    let donePromise;
    try {
      if (toProcess) {
        toProcess.forEach((it) => this.#processingQueue.push(it));
      }
      donePromise = this.#startProcessorQueueProcessor();
      let interval = 0;
      while (this.#running) {
        // eslint-disable-next-line no-await-in-loop
        await this.#wait();
        interval += 1;
        if (interval % 10 === 0) {
          this.#log.info('Processing in progress', {
            duration: Date.now() - start,
            errors: this.#errors,
            processed: this.#processed,
            processingQueueSize: this.#processingQueue.length,
          });
        }
      }
      await donePromise;
      const result = {
        duration: Date.now() - start,
        errors: this.#errors,
        processed: this.#processed,
      };
      this.#log.info('Finished processing', result);
      return result;
    } finally {
      this.#running = false;
    }
  }

  stop() {
    this.#running = false;
    this.#moreNodes = false;
  }

  /**
   * Performs a traversal of the tree
   * @param {any} [root]
   * @returns {Promise<BatchResult>}
   */
  async traverseTree(root) {
    const start = Date.now();
    this.#running = true;
    this.#moreNodes = true;
    const donePromises = [];
    try {
      if (typeof root !== 'undefined') {
        this.#traversalQueue.push(root);
      }
      donePromises.push(this.#startTraversalQueueProcessor());
      donePromises.push(this.#startProcessorQueueProcessor());
      let interval = 0;
      while (this.#running) {
        // eslint-disable-next-line no-await-in-loop
        await this.#wait();
        interval += 1;
        if (interval % 10 === 0) {
          this.#log.info('Traversal in progress', {
            duration: Date.now() - start,
            errors: this.#errors,
            processed: this.#processed,
            processingQueueSize: this.#processingQueue.length,
            traversed: this.#traversed,
            traversalQueueSize: this.#traversalQueue.length,
          });
        }
      }
      await Promise.all(donePromises);
      const result = {
        duration: Date.now() - start,
        errors: this.#errors,
        processed: this.#processed,
        traversed: this.#traversed,
      };
      this.#log.info('Finished traversing tree', result);
      return result;
    } finally {
      this.#moreNodes = false;
      this.#running = false;
    }
  }

  async #startProcessorQueueProcessor() {
    const processingStart = Date.now();
    while (this.#moreNodes || this.#processingQueue.length > 0) {
      if (this.#processingQueue.length === 0) {
        // eslint-disable-next-line no-await-in-loop
        await this.#wait();
      }
      const start = Date.now();
      this.#processingBatch = this.#processingQueue.splice(
        0,
        this.#processingQueue.length,
      );
      if (this.#processingBatch.length > 0) {
        this.#log.info('Processing batch', {
          batchSize: this.#processingBatch.length,
        });
        // eslint-disable-next-line no-await-in-loop
        await eachLimit(
          this.#processingBatch,
          this.#config.processLimit
            || this.#config.processBatchSize
            || DEFAULT_LIMIT,
          async (node) => {
            try {
              const loggableNode = this.#provider.formatForLog(node);
              this.#log.debug('Processing node', loggableNode);
              await this.#provider.process(node);
              this.#processed += 1;
            } catch (err) {
              this.#log.warn('Failed to process node', { node, err });
              this.#errors.push({
                method: 'process',
                node,
                err,
              });
            }
          },
        );
        this.#log.info('Batch processed', {
          batchSize: this.#processingBatch.length,
          duration: Date.now() - start,
        });
      }
    }
    this.#log.info('Processing complete!', {
      duration: Date.now() - processingStart,
      traversed: this.#traversed,
    });
    this.#running = false;
  }

  async #startTraversalQueueProcessor() {
    const traversalStart = Date.now();
    while (this.#traversalQueue.length > 0 && this.#running) {
      const batchStart = Date.now();
      this.#traversalBatch = this.#traversalQueue.splice(
        0,
        this.#traversalQueue.length,
      );
      this.#log.info('Traversing batch', {
        batchSize: this.#traversalBatch.length,
      });
      // eslint-disable-next-line no-await-in-loop
      await eachLimit(
        this.#traversalBatch,
        this.#config.traversalLimit
          || this.#config.traversalBatchSize
          || DEFAULT_LIMIT,
        async (node) => {
          await this.#traverseNode(node);
        },
      );
      this.#log.info('Batch traversed', {
        batchSize: this.#traversalBatch.length,
        duration: Date.now() - batchStart,
      });
    }
    this.#log.info('Traversal complete!', {
      duration: Date.now() - traversalStart,
      traversed: this.#traversed,
    });
    this.#moreNodes = false;
  }

  async #traverseNode(node) {
    let canRetry = typeof node.TRAVERSAL_RETRY === 'undefined';
    try {
      let children;
      const loggableNode = this.#provider.formatForLog(node);
      this.#log.debug('Traversing node', loggableNode);
      const hasChildren = await this.#provider.hasMore(node);
      if (hasChildren) {
        children = await this.#provider.getBatch(node);
        if (children.length > 0) {
          this.#log.debug('Found children', {
            node: loggableNode,
            count: children.length,
          });
        }
      }
      const shouldProcess = await this.#provider.shouldProcess(node);

      canRetry = false; // done with read-only changes, any failures after this and we can't retry

      children?.forEach((c) => this.#traversalQueue.push(c));
      if (shouldProcess) {
        this.#log.debug('Adding node to processing queue', loggableNode);
        this.#processingQueue.push(node);
      }
      this.#traversed += 1;
    } catch (err) {
      this.#log.warn('Failed to traverse node', { node, err });
      if (canRetry) {
        this.#traversalQueue.push({ ...node, TRAVERSAL_RETRY: true });
      } else {
        this.#errors.push({
          method: 'traverse',
          node,
          err,
        });
      }
    }
  }

  async #wait() {
    return new Promise((resolve) => {
      setTimeout(resolve, this.#config.waitDuration);
    });
  }
}
