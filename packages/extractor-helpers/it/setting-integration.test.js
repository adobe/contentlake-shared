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
/* eslint-disable no-await-in-loop */
/* eslint-env mocha */
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import assert from 'assert';
import { SettingsStore } from '../src/settings.js';

const TEST_TIMEOUT = 5000;

dotenv.config();

function loadSettings() {
  return {
    tableName: 'adobe-content-lake-extractors-dev',
  };
}

describe('Settings Store Integration Tests', async () => {
  const instances = [];
  after(async () => {
    const store = new SettingsStore(loadSettings());
    for (const instance of instances) {
      await store.deleteSettings(instance);
    }
  });

  it('fails on non-existant config', async () => {
    const store = new SettingsStore(loadSettings());
    let caught;
    try {
      await store.getConfiguration('doesnotexist');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
  }).timeout(TEST_TIMEOUT);

  it('can create, get and delete settings', async () => {
    const sourceId = randomUUID();
    instances.push(sourceId);
    const store = new SettingsStore(loadSettings());
    let value = await store.getSettings(sourceId);
    assert.ok(!value);

    await store.putSettings({
      sourceId,
      sourceType: 'test',
      spaceId: 'test',
    });

    value = await store.getSettings(sourceId);
    assert.ok(value);
    assert.strictEqual(value.sourceId, sourceId);
    assert.strictEqual(value.sourceType, 'test');

    value.sourceType = 'test2';

    await store.putSettings(value);

    value = await store.getSettings(sourceId);
    assert.strictEqual(value.sourceType, 'test2');

    await store.deleteSettings(sourceId);
    value = await store.getSettings(sourceId);
    assert.ok(!value);
  }).timeout(TEST_TIMEOUT);

  it('can change default table', async () => {
    const sourceId = randomUUID();
    instances.push(sourceId);
    const store = new SettingsStore(loadSettings());
    await store.putSettings({
      sourceId,
      sourceType: 'test',
      spaceId: 'test',
    });
    const value = await store.getSettings(sourceId);
    assert.ok(value);
    const defaultStore = new SettingsStore();
    const defaultValue = await defaultStore.getSettings(sourceId);
    assert.ok(!defaultValue);
  }).timeout(TEST_TIMEOUT);

  it('can create, get and delete settings', async () => {
    const sourceId = randomUUID();
    instances.push(sourceId);
    const store = new SettingsStore(loadSettings());
    let value = await store.getSettings(sourceId);
    assert.ok(!value);

    await store.putSettings({
      sourceId,
      sourceType: 'test',
      spaceId: 'test',
    });

    value = await store.getSettings(sourceId);
    assert.ok(value);
    assert.strictEqual(value.sourceId, sourceId);
    assert.strictEqual(value.sourceType, 'test');

    value.sourceType = 'test2';

    await store.putSettings(value);

    value = await store.getSettings(sourceId);
    assert.strictEqual(value.sourceType, 'test2');

    await store.deleteSettings(sourceId);
    value = await store.getSettings(sourceId);
    assert.ok(!value);
  }).timeout(TEST_TIMEOUT);

  describe('search', () => {
    const store = new SettingsStore(loadSettings());
    before(async () => {
      const values = ['test1', 'test2', 'test3'];
      for (const spaceId of values) {
        for (const sourceType of values) {
          const sourceId = randomUUID();
          instances.push(sourceId);
          await store.putSettings({
            sourceId,
            sourceType,
            spaceId,
          });
        }
      }
    });

    it('requires search param', async () => {
      let caught;
      try {
        await store.findSettings({});
      } catch (err) {
        caught = err;
      }
      assert.ok(caught);
      assert.strictEqual(caught.status, 400);
    }).timeout(TEST_TIMEOUT);

    it('can search by tenant', async () => {
      const res = await store.findSettings({
        filterKey: 'spaceId',
        filterValue: 'test1',
      });
      assert.ok(res);
      assert.ok(res.count > 0);
    }).timeout(TEST_TIMEOUT);

    it('can search by extractorType', async () => {
      const res = await store.findSettings({
        filterKey: 'sourceType',
        filterValue: 'test1',
      });
      assert.ok(res);
      assert.ok(res.count > 0);
    }).timeout(TEST_TIMEOUT);

    it('can limit results', async () => {
      const res = await store.findSettings({
        filterKey: 'sourceType',
        filterValue: 'test1',
        limit: 1,
      });
      assert.ok(res);
      assert.strictEqual(res.count, 1);
      assert.ok(res.cursor);
    }).timeout(TEST_TIMEOUT);

    it('can page results', async () => {
      let pages = 0;
      let res = await store.findSettings({
        filterKey: 'sourceType',
        filterValue: 'test1',
        limit: 1,
      });
      let { cursor } = res;
      while (cursor) {
        pages += 1;
        res = await store.findSettings({
          filterKey: 'sourceType',
          filterValue: 'test1',
          limit: 1,
          cursor,
        });
        cursor = res.cursor;
      }
      assert.ok(pages > 1);
    }).timeout(TEST_TIMEOUT);
  });

  it('conditional put fails if condition not met', async () => {
    const sourceId = randomUUID();
    instances.push(sourceId);
    const store = new SettingsStore(loadSettings());

    await store.putSettings({
      sourceId,
      sourceType: 'test',
      spaceId: 'test',
      jobId: '123',
    });

    const value = await store.getSettings(sourceId);

    value.jobId = '234';

    await assert.rejects(
      store.conditionalPutSettings(value, 'attribute_not_exists(jobId)'),
    );
  }).timeout(100000);
});
