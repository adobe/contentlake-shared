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
import assert from 'assert';
import { RestError } from '../src/index.js';

describe('RestError Unit Tests', () => {
  it('can construct error', async () => {
    const err = new RestError(418, 'A problem!');
    assert.strictEqual(err.status, 418);
    assert.strictEqual(err.detail, 'A problem!');
    assert.strictEqual(err.message, 'A problem!');
  });

  it('can get error as problem response', async () => {
    const err = new RestError(400, 'A problem!');
    err.instance = 'test_instance';
    err.unmappedfield = 'ruh ruh';

    const resp = RestError.toProblemResponse(err);
    assert.strictEqual(resp.status, 400);
    const body = await resp.json();
    assert.deepStrictEqual(body, {
      status: 400,
      title: 'Bad Request',
      instance: 'test_instance',
      detail: 'A problem!',
    });
  });

  it('will get title from status', async () => {
    const err = new RestError(502, 'A problem!');
    const resp = RestError.toProblemResponse(err);
    const body = await resp.json();
    assert.deepStrictEqual(body, {
      title: 'Bad Gateway',
      status: 502,
      detail: 'A problem!',
    });
  });

  it('handles unknown status', async () => {
    const err = new RestError(418, 'A problem!');
    const resp = RestError.toProblemResponse(err);
    assert.strictEqual(resp.status, 418);
    const body = await resp.json();
    assert.deepStrictEqual(body, {
      title: 'Unknown Problem',
      status: 418,
      detail: 'A problem!',
    });
  });

  it('handles no status', async () => {
    const resp = RestError.toProblemResponse({ message: 'bad things' });
    assert.strictEqual(resp.status, 500);
    const body = await resp.json();
    assert.deepStrictEqual(body, {
      title: 'Internal Server Error',
      status: 500,
      detail: 'bad things',
    });
  });

  it('can get instance from context invocation id', async () => {
    const err = new RestError(400, 'A problem!');
    const resp = RestError.toProblemResponse(err, {
      invocation: { id: 'test-id' },
    });
    assert.strictEqual(resp.status, 400);
    const body = await resp.json();
    assert.deepStrictEqual(body, {
      status: 400,
      title: 'Bad Request',
      instance: '/invocation/test-id',
      detail: 'A problem!',
    });
  });

  it('can get instance from context invocation request id', async () => {
    const err = new RestError(400, 'A problem!');
    const resp = RestError.toProblemResponse(err, {
      invocation: { id: 'test-id', requestId: 'test-request-id' },
    });
    assert.strictEqual(resp.status, 400);
    const body = await resp.json();
    assert.deepStrictEqual(body, {
      status: 400,
      title: 'Bad Request',
      instance: '/invocation/test-request-id',
      detail: 'A problem!',
    });
  });

  it('can specify additional properties', async () => {
    const err = new RestError(400, 'A problem!', { todo: 'fix' });
    const resp = RestError.toProblemResponse(err, {
      invocation: { id: 'test-id', requestId: 'test-request-id' },
    });
    assert.strictEqual(resp.status, 400);
    const body = await resp.json();
    assert.deepStrictEqual(body, {
      status: 400,
      title: 'Bad Request',
      instance: '/invocation/test-request-id',
      detail: 'A problem!',
      todo: 'fix',
    });
  });
});
