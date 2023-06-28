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
/* eslint-disable class-methods-use-this  */
/* eslint-disable no-unused-vars */

/**
 * A BatchProvider provides batches and items to process to the BatchExecutor. This implementation
 * will do nothing.
 * Implementations should implement this class, implementing the required methods for the use case.
 */
export class BaseBatchProvider {
  /**
   * Formats the item for logging
   * @param {any} item the item to format
   * @returns {any} the formatted item to log
   */
  formatForLog(item) {
    return item;
  }

  /**
   * Returns the next batch of items
   * @param {any} item the item from which to get the next batch
   * @returns {Promise<any>}
   */
  async getBatch(item) {
    return Promise.resolve([]);
  }

  /**
   * Checks whether or not there are more items which can be retrieved from the current item
   * @param {any} item the item to check if there are more items
   * @returns {Promise<boolean>}
   */
  async hasMore(item) {
    return Promise.resolve(false);
  }

  /**
   * Processes the specified item. This is a terminal operation for the item.
   * Examples could include sending the item to the ingestion service or logging the
   * item for a report.
   * @param {any} item the item to process
   * @returns {Promise<void>}
   */
  async process(item) {
    return Promise.resolve();
  }

  /**
   * Checks if the item should be processed.
   * @param {any} item the item to evaluate if it should be processed
   * @returns {Promise<boolean>} true if the item should be processed
   */
  async shouldProcess(item) {
    return Promise.resolve(false);
  }
}
