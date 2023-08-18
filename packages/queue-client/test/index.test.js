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
import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { QueueClient } from '../src/index.js';

const mockSqsClient = mockClient(SQSClient);

const LARGE_MESSAGE = {
  // generates a 128KB string by joining the alphabet 5120 times
  msg: [...Array(5120)].map(() => 'abcdefghijklmnopqrstuvwxyz').join(''),
};

describe('QueueClient Unit Tests', () => {
  afterEach(() => mockSqsClient.reset());

  it('can get client', () => {
    const client = new QueueClient({});
    assert.ok(client);
  });

  it('can send message', async () => {
    mockSqsClient.on(SendMessageCommand).callsFake((input) => {
      assert.deepStrictEqual(input, {
        MessageBody: '{"message":"Hello World!"}',
        QueueUrl: 'http://www.queue.com',
      });
      return {
        MessageId: 'test-id',
      };
    });
    const client = new QueueClient({
      client: mockSqsClient,
      queueUrl: 'http://www.queue.com',
    });
    const resp = await client.sendMessage({ message: 'Hello World!' });
    assert.strictEqual(resp, 'test-id');
  });

  it('throws on create message failure', async () => {
    mockSqsClient.on(SendMessageCommand).rejects();
    const client = new QueueClient({
      client: mockSqsClient,
      queueUrl: 'http://www.queue.com',
    });
    let caught;
    try {
      await client.sendMessage({ message: 'Hello World!' });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
  });

  it('can remove message', async () => {
    mockSqsClient.on(DeleteMessageCommand).callsFake((input) => {
      assert.strictEqual(input.ReceiptHandle, 'test-handle');
    });
    const client = new QueueClient({
      client: mockSqsClient,
      queueUrl: 'http://www.queue.com',
    });
    await client.removeMessage('test-handle');
  });

  it('remove handles throws', async () => {
    mockSqsClient.on(DeleteMessageCommand).rejects();
    const client = new QueueClient({
      client: mockSqsClient,
      queueUrl: 'http://www.queue.com',
    });
    await assert.rejects(() => client.removeMessage('test-handle'));
  });

  it('fails on large message if no blob storage provided', async () => {
    const client = new QueueClient({
      client: mockSqsClient,
      queueUrl: 'http://www.queue.com',
    });

    await assert.rejects(() => client.sendMessage(LARGE_MESSAGE));
  });

  it('can send large messages', async () => {
    const blobs = {};
    const mockBlobStorage = {
      save: (key, buf) => {
        blobs[key] = buf.toString('utf-8');
      },
    };
    mockSqsClient.on(SendMessageCommand).callsFake((input) => {
      const { blobStorage, key } = JSON.parse(input.MessageBody);
      assert.strictEqual(blobStorage, true);
      assert.strictEqual(blobs[key].message, LARGE_MESSAGE.message);
      assert.ok(blobs[key]);
      return {
        MessageId: 'test-message-id',
      };
    });

    const client = new QueueClient({
      client: mockSqsClient,
      queueUrl: 'http://www.queue.com',
      blobStorage: mockBlobStorage,
    });

    const id = await client.sendMessage(LARGE_MESSAGE);
    assert.strictEqual(id, 'test-message-id');
  });

  it('can read large messages', async () => {
    const blobs = { test: JSON.stringify(LARGE_MESSAGE) };
    const mockBlobStorage = {
      getString: (key) => blobs[key],
    };
    const client = new QueueClient({
      queueUrl: 'http://www.queue.com',
      blobStorage: mockBlobStorage,
    });

    const messageBody = await client.readMessageBody(
      JSON.stringify({
        blobStorage: true,
        key: 'test',
      }),
    );
    assert.strictEqual(messageBody.message, LARGE_MESSAGE.message);
  });

  it('can read normal sized messages', async () => {
    const client = new QueueClient({
      queueUrl: 'http://www.queue.com',
    });

    const messageBody = await client.readMessageBody(
      JSON.stringify({
        message: 'Hello World!',
      }),
    );
    assert.strictEqual(messageBody.message, 'Hello World!');
  });

  it('will fail to read large message if no blob storage provided', async () => {
    const client = new QueueClient({
      client: mockSqsClient,
      queueUrl: 'http://www.queue.com',
    });

    await assert.rejects(() => client.readMessageBody(
      JSON.stringify({
        blobStorage: true,
        key: 'test',
      }),
    ));
  });

  describe('isQueueRequest', () => {
    it('will not fail if undefined', () => {
      assert.ok(!QueueClient.isQueueRequest({}));
    });

    it('will not fail if not present', () => {
      assert.ok(
        !QueueClient.isQueueRequest({
          invocation: { event: {} },
        }),
      );
    });

    it('will return true on empty records array', () => {
      assert.ok(
        QueueClient.isQueueRequest({
          invocation: {
            event: {
              Records: [],
            },
          },
        }),
      );
    });
  });

  describe('get sqs records', () => {
    it('will not fail if not present', () => {
      assert.ok(QueueClient.extractQueueRecords({}));
    });

    it('will extract records', () => {
      const res = QueueClient.extractQueueRecords({
        invocation: {
          event: {
            Records: [
              {
                messageId: 'af88e691-c3a6-4b46-b4d2-1c897b41b600',
                receiptHandle:
                  'AQEBJCLTpWgDm+oaeBAlSKWumzIoFRHeJglHCwWEfJANgc7GSWQBcYTiLPfbO1IuxAIkJagUIEkqgmszqnj2a7hLZjoIcv0AWCQfL0tmje/hhnDWYKdQmrUmfITdPDIg49XI+n+Ub/gKjXEy3VvunLsp0bxuF33OCsR8+N0Skff+U+zan+42GcHtn8lacm6ZQIF9msoFxszourA+zpJ/DJ1DTMlEpr9cSPxa6nsbg7JHOOwBzWknn7d3Zkimuo/J3shMyb+4fBYFRNpzXt9o9l8rfQpi9JZDwGIFRqDYFvpI0Emqv9ke1V2uBAJPiiGS0h1MIKO6dZZ/ejfWAR0Rug3zMEH9SEa6N+hT4gF5Pu2IN6WmcRhE4sh0jW/ImAAunuIo/OZ1FhNjqp+keK3AvBiPiQ==',
                body: '{"message":"Hello World"}',
                attributes: {
                  ApproximateReceiveCount: '1',
                  SentTimestamp: '1678764328689',
                  SenderId: 'AIDAXXYBVS2FJDJXJ56HK',
                  ApproximateFirstReceiveTimestamp: '1678764328690',
                },
                messageAttributes: {},
                md5OfBody: 'd7e5fb40d1b43e304158449c3ecd6e5c',
                eventSource: 'aws:sqs',
                eventSourceARN:
                  'arn:aws:sqs:us-east-1:532042585738:content-lake-it',
                awsRegion: 'us-east-1',
              },
            ],
          },
        },
      });
      assert.strictEqual(res.length, 1);
      assert.strictEqual(
        res[0].messageId,
        'af88e691-c3a6-4b46-b4d2-1c897b41b600',
      );
    });
  });
});
