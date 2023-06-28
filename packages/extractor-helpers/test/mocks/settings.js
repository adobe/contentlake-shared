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

/**
 * A mock for the SettingsStore.
 *
 * Either call the put method or set the settings property of this class
 * directly to set the settings
 *
 * @see {SettingsStore}
 */
export class MockSettingsStore {
  /**
   * The settings in the store
   */
  settings = {};

  /**
   * The cursor to return from the findSettings call
   */
  findCursor;

  /**
   * The query used to find settings
   */
  findQuery;

  /**
   * True if the conditional request should fail
   */
  conditionalFail = false;

  /**
   * Resets the mock to it's original state
   */
  reset() {
    this.settings = {};
    this.findCursor = undefined;
    this.findQuery = undefined;
    this.conditionalFail = false;
  }

  async deleteSettings(sourceId) {
    delete this.settings[sourceId];
  }

  async getSettings(sourceId) {
    return this.settings[sourceId];
  }

  async findSettings(query) {
    this.findQuery = query;
    const items = Object.values(this.settings);
    return { items, count: items.length, cursor: this.findCursor };
  }

  async putSettings(settings) {
    const { sourceId } = settings;
    this.settings[sourceId] = settings;
  }

  async conditionalPutSettings(settings) {
    if (this.conditionalFail) {
      throw new Error('Failed conditional check');
    }
    const { sourceId } = settings;
    this.settings[sourceId] = settings;
  }
}
