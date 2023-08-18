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
export class MockQueueClient {
  messages = [];

  removed = [];

  async sendMessage(message) {
    const id = this.messages.push(message);
    return id.toString();
  }

  /**
   * Reads the message, reading from blob storage if required
   * @param {string} messageBody
   * @returns {Promise<Object>}
   */
  // eslint-disable-next-line class-methods-use-this
  async readMessageBody(messageBody) {
    return JSON.parse(messageBody);
  }

  async removeMessage(receiptHandle) {
    this.removed.push(receiptHandle);
  }

  reset() {
    this.messages = [];
    this.removed = [];
  }
}
