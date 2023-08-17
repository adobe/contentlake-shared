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
import { randomUUID } from 'crypto';
import { Router } from '../src/index.js';

function mockContext(suffix) {
  return {
    pathInfo: {
      suffix,
    },
    env: {},
    invocation: {
      id: randomUUID(),
    },
  };
}

describe('Router Tests', () => {
  it('can route request', async () => {
    const router = new Router();
    router.get('/', () => new Response('Hello World'));

    const response = await router.handle(
      new Request('https://localhost/'),
      mockContext('/'),
    );
    assert.ok(response);
    assert.strictEqual(response.status, 200);
    const body = await response.text();
    assert.strictEqual(body, 'Hello World');
  });

  it('can route different request', async () => {
    let root = false;
    let test = false;
    const router = new Router();
    router
      .get('/', () => {
        root = true;
      })
      .get('/test', () => {
        test = true;
      });

    await router.handle(new Request('https://localhost/'), mockContext('/'));
    assert.ok(root);
    assert.ok(!test);

    await router.handle(
      new Request('https://localhost/'),
      mockContext('/test'),
    );
    assert.ok(test);
  });

  it('returns 405 on unrouted', async () => {
    const router = new Router();
    router.get('/', () => new Response());

    const response = await router.handle(
      new Request('https://localhost/', { method: 'POST' }),
      mockContext('/'),
    );
    assert.ok(response);
    assert.strictEqual(405, response.status);
    assert.strictEqual(
      'application/problem+json',
      response.headers.get('Content-Type'),
    );
  });

  describe('can register common methods', () => {
    const router = new Router();

    router
      .get('/', () => new Response('GET'))
      .delete('/', () => new Response('DELETE'))
      .post('/', () => new Response('POST'))
      .put('/', () => new Response('PUT'));

    ['GET', 'POST', 'DELETE', 'PUT'].forEach((method) => {
      it(`Handles ${method}`, async () => {
        const response = await router.handle(
          new Request('https://localhost/', { method }),
          mockContext('/'),
        );
        assert.ok(response);
        assert.strictEqual(200, response.status);
        const body = await response.text();
        assert.strictEqual(body, method);
      });
    });
  });

  it('handles throwing handler of handling things', async () => {
    const router = new Router();

    router.get('/', () => {
      throw new Error('generic');
    });

    const response = await router.handle(
      new Request('https://localhost/'),
      mockContext('/'),
    );
    assert.ok(response);
    assert.strictEqual(500, response.status);
    const body = await response.json();

    assert.strictEqual(
      'application/problem+json',
      response.headers.get('Content-Type'),
    );
    assert.strictEqual('Internal Server Error', body.title);
  });

  [undefined, ''].map(async (suffix) => {
    it(`uses / for suffix if suffix = '${suffix}'`, async () => {
      const router = new Router().get('/', () => new Response('GET'));
      const response = await router.handle(
        new Request('https://localhost/', { method: 'GET' }),
        mockContext(suffix),
      );
      assert.equal(response.status, 200);
    });
  });

  it('does not fail if pathInfo not defined', async () => {
    const router = new Router().get('/', () => new Response('GET'));
    const response = await router.handle(
      new Request('https://localhost/', { method: 'GET' }),
      {
        env: {},
        invocation: {
          id: randomUUID(),
        },
      },
    );
    assert.equal(response.status, 200);
  });

  it('parses params', async () => {
    const router = new Router();

    router.get(
      '/:id',
      (_req, params) => new Response(JSON.stringify({ id: params.id })),
    );

    const response = await router.handle(
      new Request('https://localhost/'),
      mockContext('/test-id'),
    );
    assert.ok(response);
    assert.strictEqual(200, response.status);
    const body = await response.json();
    assert.deepStrictEqual(body, { id: 'test-id' });
  });

  it('passes request params and context', async () => {
    const router = new Router();

    const request = new Request('https://localhost/');
    const context = mockContext('/test-id2');
    router.get('/:id', (req, params, ctx) => {
      assert.strictEqual(req, request);
      assert.strictEqual(ctx, context);
      return new Response(JSON.stringify({ id: params.id }));
    });

    const response = await router.handle(request, context);
    assert.ok(response);
    assert.strictEqual(200, response.status);
    const body = await response.json();
    assert.deepStrictEqual(body, { id: 'test-id2' });
  });

  it('handles object responses', async () => {
    const router = new Router();
    router.get('/', () => ({
      message: 'Hello World',
    }));

    const response = await router.handle(
      new Request('https://localhost/'),
      mockContext('/'),
    );
    assert.ok(response);
    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.deepStrictEqual(body, { message: 'Hello World' });
  });
});
