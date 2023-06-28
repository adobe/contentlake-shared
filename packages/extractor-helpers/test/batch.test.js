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
/* eslint-env mocha */
/* eslint-disable max-classes-per-file */
/* eslint-disable class-methods-use-this */

import assert from 'assert';
import util from 'util';
import { BaseBatchProvider, batch } from '../src/index.js';

const sleep = util.promisify(setTimeout);

describe('Batch Tests', () => {
  it('provider required', () => {
    let caught;
    try {
      const traverser = new batch.BatchExecutor();
      assert.ok(traverser);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
  });

  it('can reload state', () => {
    const state = {
      errors: ['bad'],
      processed: 1,
      processingQueue: ['file3'],
      traversed: 1,
      traversalQueue: ['folder3'],
      processingBatch: ['file2'],
      traversalBatch: ['folder2'],
    };
    const executor = new batch.BatchExecutor(new BaseBatchProvider());
    executor.setState(state);

    const newState = executor.getState();
    [
      'errors',
      'processed',
      'processingQueue',
      'traversed',
      'traversalQueue',
    ].forEach((k) => {
      assert.strictEqual(
        newState[k],
        state[k],
        `Mismatched key ${k} in batch executor`,
      );
    });
    Object.keys(state).forEach((k) => {
      assert.strictEqual(
        newState[k],
        state[k],
        `Mismatched key ${k} in new state`,
      );
    });
  });

  it('can reload empty state', () => {
    const executor = new batch.BatchExecutor(new BaseBatchProvider());
    executor.setState({});
  });

  describe('processing', () => {
    it('will terminate', async () => {
      const executor = new batch.BatchExecutor(new BaseBatchProvider());
      const res = await executor.processItems();
      assert.ok(res);
    });

    it('will process provided batch', async () => {
      const executor = new batch.BatchExecutor(new BaseBatchProvider());
      const res = await executor.processItems(['hi']);
      assert.ok(res);
    });

    it('will log in interval', async () => {
      class SlowProcessor extends BaseBatchProvider {
        async process() {
          return sleep(2000);
        }
      }
      const executor = new batch.BatchExecutor(new SlowProcessor());
      const res = await executor.processItems(['hi']);
      assert.ok(res);
    }).timeout(3000);

    it('can stop', async () => {
      class SlowTraverser extends BaseBatchProvider {
        hasMore() {
          return true;
        }

        async getBatch() {
          await sleep(2000);
          return ['world'];
        }
      }
      const executor = new batch.BatchExecutor(new SlowTraverser());
      const promise = executor.traverseTree('hello');
      executor.stop();
      await promise;
      const state = executor.getState();
      assert.strictEqual(state.traversalQueue.length, 1);
    }).timeout(6000);
  });

  describe('traversal', () => {
    it('will terminate', async () => {
      const executor = new batch.BatchExecutor(new BaseBatchProvider());
      const res = await executor.traverseTree('');
      assert.ok(res);
    });

    it('will traverse from state', async () => {
      const executor = new batch.BatchExecutor(new BaseBatchProvider());
      executor.setState({
        traversalQueue: ['test'],
      });
      const res = await executor.traverseTree();
      assert.ok(res);
      assert.strictEqual(res.traversed, 1);
    });

    it('will traverse and read items from state', async () => {
      class MoreProvider extends BaseBatchProvider {
        hasMore() {
          return true;
        }
      }

      const executor = new batch.BatchExecutor(new MoreProvider());
      executor.setState({
        traversalQueue: ['test'],
      });
      const res = await executor.traverseTree();
      assert.ok(res);
      assert.strictEqual(res.traversed, 1);
    });

    it('will process remaining queue items', async () => {
      class SleepyBatchProvider extends BaseBatchProvider {
        async process() {
          sleep(2000);
        }
      }
      const executor = new batch.BatchExecutor(new SleepyBatchProvider());
      executor.setState({
        errors: [],
        processed: 2,
        processingQueue: ['file3'],
        traversed: 2,
        traversalQueue: [],
        processingBatch: [],
        traversalBatch: [],
      });
      const res = await executor.traverseTree();
      assert.ok(res);
      const state = executor.getState();
      assert.strictEqual(state.processingQueue.length, 0);
      assert.strictEqual(state.processed, 3);
    }).timeout(2500);

    it('handles processor errors', async () => {
      class FailingBatchProvider extends BaseBatchProvider {
        async process() {
          throw new Error('bad');
        }
      }
      const executor = new batch.BatchExecutor(new FailingBatchProvider());
      executor.setState({
        errors: [],
        processed: 2,
        processingQueue: ['file3'],
        traversed: 2,
        traversalQueue: [],
        processingBatch: [],
        traversalBatch: [],
      });
      const res = await executor.traverseTree();
      assert.ok(res);

      const state = executor.getState();
      assert.strictEqual(state.processingQueue.length, 0);
      assert.strictEqual(state.processed, 2);
      assert.strictEqual(state.errors.length, 1);
      assert.strictEqual(state.errors[0].node, 'file3');
      assert.ok(state.errors[0].err);
    });

    it('can traverse tree', async () => {
      const familyTree = {
        name: 'Sue',
        child: {
          name: 'Dan',
          granchild1: {
            name: 'Sarah',
          },
          granchild2: {
            name: 'Will',
          },
        },
        child2: {
          name: 'Megan',
          granchild1: {
            name: 'Charles',
          },
          granchild2: {
            name: 'Clara',
          },
        },
        child3: {
          name: 'Mara',
        },
      };

      const names = new Set();
      class TreeProvider extends BaseBatchProvider {
        async getBatch(node) {
          await sleep(10);
          return Object.keys(node).map((k) => node[k]);
        }

        hasMore(node) {
          return typeof node !== 'string';
        }

        async process(node) {
          await sleep(10);
          names.add(node);
        }

        shouldProcess(node) {
          return typeof node === 'string';
        }
      }
      const executor = new batch.BatchExecutor(new TreeProvider(), {
        processBatchSize: 2,
        traversalBatchSize: 2,
        waitDuration: 10,
      });
      const res = await executor.traverseTree(familyTree);
      assert.ok(res);
      const state = executor.getState();
      assert.strictEqual(state.processingQueue.length, 0);
      assert.strictEqual(state.traversalQueue.length, 0);
      assert.strictEqual(state.processed, 8);
      assert.strictEqual(state.traversed, 16);
      assert.strictEqual(state.errors.length, 0);
      [
        'Sue',
        'Dan',
        'Sarah',
        'Will',
        'Megan',
        'Charles',
        'Clara',
        'Mara',
      ].forEach((name) => assert.ok(names.has(name)));
    });

    it('will retry on failure', async () => {
      class SadProvider extends BaseBatchProvider {
        hasMore(node) {
          const shouldThrow = node.values.shift();
          if (shouldThrow) {
            throw new Error('sad');
          }
          return false;
        }
      }
      const executor = new batch.BatchExecutor(new SadProvider());
      executor.setState({
        errors: [],
        processed: 0,
        processingQueue: [],
        traversed: 0,
        traversalQueue: [
          { values: [false] },
          { values: [true, false] },
          { values: [true, true, false] },
        ],
        processingBatch: [],
        traversalBatch: [],
      });
      const res = await executor.traverseTree();
      assert.ok(res);
      const state = executor.getState();
      assert.strictEqual(state.traversalQueue.length, 0);
      assert.strictEqual(state.traversed, 2);
      assert.strictEqual(state.errors.length, 1);
    });

    it('will log in interval', async () => {
      class SlowTraverser extends BaseBatchProvider {
        async hasMore() {
          return sleep(2000);
        }
      }
      const executor = new batch.BatchExecutor(new SlowTraverser());
      const res = await executor.traverseTree('hi');
      assert.ok(res);
    }).timeout(3000);
  });
});
