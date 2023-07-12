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
import { createHash, randomUUID } from 'crypto';
import assert from 'assert';
import { stub } from 'sinon';
import { RequestHandler } from '../src/index.js';

const MOCK_REQUEST = new Request('http://localhost', { method: 'POST' });
function mockContext(event) {
  return {
    invocation: {
      event: event || {},
    },
    env: {
      QUEUE_URL: 'http://testqueue.com',
      QUEUE_STORAGE_BUCKET: 'queue-test',
    },
  };
}

function mockSqsRecord(action) {
  return {
    messageId: randomUUID(),
    receiptHandle: 'SOME_JWT',
    body: `{"action":"${action}"}`,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: Date.now(),
      SenderId: randomUUID(),
      ApproximateFirstReceiveTimestamp: Date.now(),
    },
    messageAttributes: {},
    md5OfBody: createHash('md5').update(`{"action":"${action}"}`).digest('hex'),
    eventSource: 'aws:sqs',
  };
}

describe('Request Handler Tests', () => {
  describe('main', () => {
    it('can get main', () => {
      const requestHandler = new RequestHandler();
      const main = requestHandler.getMain();
      assert.ok(main);
    });

    it('main requires context / request', async () => {
      const requestHandler = new RequestHandler();
      const main = requestHandler.getMain();
      let caught;
      try {
        await main(undefined, undefined);
      } catch (err) {
        caught = err;
      }
      assert.ok(caught);
    });

    it('main handles unexpected exceptions', async () => {
      const requestHandler = new RequestHandler().withHandler('throw', () => {
        throw new Error('Surprise!');
      });
      const main = requestHandler.getMain();
      const res = await main(MOCK_REQUEST, mockContext({ action: 'throw' }));
      assert.strictEqual(res.status, 500);
    });

    it('can supply wrapper function', async () => {
      const requestHandler = new RequestHandler().withWrapFunction((fn) => fn);
      const main = requestHandler.getMain();
      assert.ok(main);
    });
  });

  describe('handler', () => {
    it('will throw on undefined action', async () => {
      const requestHandler = new RequestHandler().withHandler(
        'test',
        () => new Response(),
      );
      let caught;
      try {
        await requestHandler.handleEvent(
          {
            payload: 'Hello World',
          },
          mockContext(),
        );
      } catch (err) {
        caught = err;
      }
      assert.ok(caught);
      assert.strictEqual(caught.status, 400);
    });

    it('will throw on unknown action', async () => {
      const requestHandler = new RequestHandler().withHandler(
        'test',
        () => new Response(),
      );
      let caught;
      try {
        await requestHandler.handleEvent({ action: 'test2' }, mockContext());
      } catch (err) {
        caught = err;
      }
      assert.ok(caught);
      assert.strictEqual(caught.status, 400);
    });

    it('will not fail to destructure on undefined event', async () => {
      const requestHandler = new RequestHandler().withHandler(
        'test',
        () => new Response(),
      );
      let caught;
      try {
        await requestHandler.handleEvent(undefined, mockContext());
      } catch (err) {
        caught = err;
      }
      assert.ok(caught);
      assert.strictEqual(caught.status, 400);
    });

    it('can add/invoke actions', async () => {
      let event;
      const requestHandler = new RequestHandler().withHandler('test', (evt) => {
        event = evt;
        return new Response();
      });
      const main = requestHandler.getMain();
      const res = await main(
        MOCK_REQUEST,
        mockContext({ action: 'test', message: 'Hello World' }),
      );
      assert.ok(event);
      assert.strictEqual(event.message, 'Hello World');
      assert.ok(res.ok);
    });

    it('can handle successful SQS record(s)', async () => {
      const events = [];
      const requestHandler = new RequestHandler().withHandler('test', (evt) => {
        events.push(evt);
        return new Response();
      });

      const removed = [];
      stub(requestHandler, 'getQueueClient').returns({
        removeMessage: (handle) => removed.push(handle),
        readMessageBody: (msgBody) => JSON.parse(msgBody),
      });
      const main = requestHandler.getMain();
      const res = await main(
        MOCK_REQUEST,
        mockContext({
          Records: [mockSqsRecord('test'), mockSqsRecord('test')],
        }),
      );
      assert.ok(res.ok);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(events.length, 2);
      assert.strictEqual(removed.length, 2);
    });

    it('can handle SQS record(s) with failures', async () => {
      const events = [];
      const requestHandler = new RequestHandler()
        .withHandler('test', (evt) => {
          events.push(evt);
          return new Response();
        })
        .withHandler('fail', (evt) => {
          events.push(evt);
          return new Response('bad request', { status: 400 });
        })
        .withHandler('throw', (evt) => {
          events.push(evt);
          throw new Error('bad news');
        });

      const removed = [];
      stub(requestHandler, 'getQueueClient').returns({
        removeMessage: (handle) => removed.push(handle),
        readMessageBody: (msgBody) => JSON.parse(msgBody),
      });
      const main = requestHandler.getMain();
      const res = await main(
        MOCK_REQUEST,
        mockContext({
          Records: [
            mockSqsRecord('test'),
            mockSqsRecord('fail'),
            mockSqsRecord('throw'),
          ],
        }),
      );
      assert.ok(res.ok);
      assert.strictEqual(res.status, 206);
      const body = await res.json();
      assert.strictEqual(body.batchItemFailures.length, 2);
      assert.strictEqual(events.length, 3);
      assert.strictEqual(removed.length, 1);
    });
  });

  describe('getQueueClient', () => {
    it('can get queue client', async () => {
      const requestHandler = new RequestHandler();
      const queueClient = requestHandler.getQueueClient(mockContext());
      assert.ok(queueClient);
    });

    it('can get queue client without bucket', async () => {
      const requestHandler = new RequestHandler();
      const queueClient = requestHandler.getQueueClient({
        env: {
          QUEUE_URL: 'http://test.queue.com',
        },
      });
      assert.ok(queueClient);
    });

    it('getQueueClient requires queue url', async () => {
      const requestHandler = new RequestHandler();
      let caught;
      try {
        requestHandler.getQueueClient({ env: {} });
      } catch (err) {
        caught = err;
      }
      assert.ok(caught);
    });
  });
});
