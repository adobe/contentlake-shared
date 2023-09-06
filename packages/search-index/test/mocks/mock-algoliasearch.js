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

/* eslint-disable no-console */
/* eslint-disable class-methods-use-this */

export class MockAlgoliaSearch {
  constructor() {
    console.log('Mocked algolia search client called');
    this.storage = {};
  }

  // eslint-disable-next-line class-methods-use-this
  initIndex(indexName) {
    console.log('Mocked Init index called', indexName);
    return this;
  }

  async search(query, options) {
    console.log('Mocked Search called with query', query, 'and options', options);
    let hits;
    if (options && options.facetFilters) {
      const facetFilters = options.facetFilters.map((filter) => filter.split(':'));
      console.log('Mocked Search called with facetFilters', facetFilters);
      hits = Object.values(this.storage)
        .filter((object) => facetFilters.every((filter) => object[filter[0]] === filter[1]));
    }
    return {
      nbHits: hits.length,
      hits,
    };
  }

  async saveObject(object) {
    console.log('Mocked Save object called with object', object);
    this.storage[object.objectID] = object;
    return object;
  }

  async partialUpdateObjects(objects) {
    console.log('Partial update objects called with objects', objects);
    // no need to implement this logic for now. Just make sure this method was called
    return objects;
  }

  async deleteObject(objectId) {
    console.log('Mocked Delete object called with objectId', objectId);
    delete this.storage[objectId];
    return objectId;
  }

  async deleteBy(params) {
    console.log('Mocked Delete by called with params', params);
    // no need to implement this logic for now. Just make sure this method was called
    return params;
  }

  copyIndex(indexName, destinationIndexName, scope) {
    console.log(`Mocked copy index ${indexName} to ${destinationIndexName} with scope ${scope}`);
    return { taskID: 'mockedTaskId' };
  }

  copySettings(indexName, destinationIndexName) {
    console.log(`Mocked copy index settings ${indexName} to ${destinationIndexName}`);
  }

  moveIndex(indexName, destinationIndexName) {
    console.log(`Mocked move index ${indexName} to ${destinationIndexName}`);
    return { taskID: 'mockedTaskId' };
  }

  waitTask(taskID) {
    console.log(`Mock wait task ${taskID} finish`);
    return undefined;
  }
}
