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

/* eslint-env mocha */
import assert from 'assert';
import { SettingsStore } from '../src/settings.js';

class MockClient {
  resp;

  req;

  send(req) {
    this.req = req;
    return this.resp;
  }
}

describe('SettingsStore Unit Tests', () => {
  it('can get store', () => {
    const store = new SettingsStore({});
    assert.ok(store);
  });

  it('can get settings', async () => {
    const mockClient = new MockClient();
    const store = new SettingsStore({ client: mockClient });
    mockClient.resp = {
      Item: {
        message: {
          S: 'Hello World',
        },
      },
    };
    const resp = await store.getSettings('test');
    assert.strictEqual(resp.message, 'Hello World');
    assert.strictEqual(mockClient.req.input.Key.sourceId.S, 'test');
  });

  it('deserializeItem does not fail on undefined', () => {
    const res = SettingsStore.deserializeItem(undefined);
    assert.ok(!res);
  });

  it('can delete settings', async () => {
    const mockClient = new MockClient();
    const store = new SettingsStore({ client: mockClient });
    await store.deleteSettings('test');
    assert.strictEqual(mockClient.req.input.Key.sourceId.S, 'test');
  });

  it('can put settings', async () => {
    const mockClient = new MockClient();
    const store = new SettingsStore({ client: mockClient });
    await store.putSettings({ sourceId: 'test', someotherkey: 'value' });
    assert.strictEqual(mockClient.req.input.Item.sourceId.S, 'test');
    assert.strictEqual(mockClient.req.input.Item.someotherkey.S, 'value');
  });

  describe('findSettings', () => {
    it('findSettings requires sourceType or spaceId', async () => {
      const mockClient = new MockClient();
      const store = new SettingsStore({ client: mockClient });
      let caught;
      try {
        await store.findSettings({});
      } catch (err) {
        caught = err;
      }
      assert.ok(caught);
      assert.equal(caught.status, 400);
    });

    it('can findSettings by sourceType', async () => {
      const mockClient = new MockClient();
      mockClient.resp = {
        Items: [{ key: { S: 'value' } }],
        Count: 1,
        LastEvaluatedKey: 'cursor',
      };
      const store = new SettingsStore({ client: mockClient });
      const res = await store.findSettings({
        filterKey: 'sourceType',
        filterValue: 'test',
      });

      assert.strictEqual(res.items[0].key, 'value');
      assert.strictEqual(res.count, 1);
      assert.strictEqual(res.cursor, 'cursor');

      assert.strictEqual(
        mockClient.req.input.KeyConditionExpression,
        'sourceType=:value',
      );
      assert.strictEqual(
        mockClient.req.input.ExpressionAttributeValues[':value'].S,
        'test',
      );
    });

    it('can findSettings by spaceId', async () => {
      const mockClient = new MockClient();
      mockClient.resp = {
        Items: [{ key: { S: 'value' } }],
        Count: 1,
        LastEvaluatedKey: 'cursor',
      };
      const store = new SettingsStore({ client: mockClient });
      const res = await store.findSettings({
        filterKey: 'spaceId',
        filterValue: 'test',
      });

      assert.strictEqual(res.items[0].key, 'value');
      assert.strictEqual(res.count, 1);
      assert.strictEqual(res.cursor, 'cursor');
      assert.strictEqual(
        mockClient.req.input.KeyConditionExpression,
        'spaceId=:value',
      );
      assert.strictEqual(
        mockClient.req.input.ExpressionAttributeValues[':value'].S,
        'test',
      );
    });

    it('can set limit and cursor', async () => {
      const mockClient = new MockClient();
      mockClient.resp = {
        Items: [{ key: { S: 'value' } }],
        Count: 1,
        LastEvaluatedKey: 'cursor',
      };
      const store = new SettingsStore({
        client: mockClient,
      });
      await store.findSettings({
        filterKey: 'spaceId',
        filterValue: 'test',
        limit: 10,
        cursor: 'test-cursor',
      });

      assert.strictEqual(mockClient.req.input.Limit, 10);
      assert.strictEqual(mockClient.req.input.ExclusiveStartKey, 'test-cursor');
    });

    it('can perform conditional put', async () => {
      const mockClient = new MockClient();
      mockClient.resp = {
        Items: [{ key: { S: 'value' } }],
        Count: 1,
        LastEvaluatedKey: 'cursor',
      };
      const store = new SettingsStore({
        client: mockClient,
      });
      await store.conditionalPutSettings(
        {
          sourceId: 'test',
          sourceType: 'test',
        },
        'field=:value',
        { value: 'test' },
      );

      assert.strictEqual(
        mockClient.req.input.ConditionExpression,
        'field=:value',
      );
      assert.strictEqual(
        mockClient.req.input.ExpressionAttributeValues.value.S,
        'test',
      );
    });

    it('can perform conditional put without value', async () => {
      const mockClient = new MockClient();
      mockClient.resp = {
        Items: [{ key: { S: 'value' } }],
        Count: 1,
        LastEvaluatedKey: 'cursor',
      };
      const store = new SettingsStore({
        client: mockClient,
      });
      await store.conditionalPutSettings(
        {
          sourceId: 'test',
          sourceType: 'test',
        },
        'field=:value',
      );

      assert.strictEqual(
        mockClient.req.input.ConditionExpression,
        'field=:value',
      );
      assert.strictEqual(
        mockClient.req.input.ExpressionAttributeValues,
        undefined,
      );
    });
  });
});
