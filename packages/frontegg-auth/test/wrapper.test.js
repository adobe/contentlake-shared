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
/* eslint-disable no-console */

import assert from 'assert';
import { Request, Response } from '@adobe/fetch';
import wrap from '@adobe/helix-shared-wrap';
import { auth } from '../src/index.js';
import { createJWT, PUBLIC_KEY } from './jwt.js';
import { assertPartialObjectMatch } from './utils.js';

const log = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  // info: console.log,
  // warn: console.log,
  // error: console.error,
  // debug: console.log,
};

describe('auth wrapper', () => {
  function mockSpace(host, id) {
    // TODO: replace with nock?
    process.env[`MOCK_SPACE_${host}`] = id;
  }

  beforeEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('MOCK_SPACE_')) {
        delete process.env[key];
      }
    });
  });

  it('should throw error if auth is passed to wrap().with() without invocation', async () => {
    const universalFn = async () => new Response('ok');

    assert.throws(() => {
      wrap(universalFn).with(auth);
    });
  });

  it('should not throw error if auth() is invoked before passing to wrap().with()', async () => {
    const universalFn = async (request, context) => {
      // check that data is properly passed through
      assert.deepEqual(context.data, { some: 'value' });
      return new Response('ok');
    };

    try {
      const actualFn = wrap(universalFn).with(auth({
        skip: true,
      }));

      await actualFn(new Request('http://localhost?foo=bar'), {
        log,
        data: {
          some: 'value',
        },
      });
    } catch (e) {
      assert.fail('should not throw error');
    }
  });

  // smoke test for authentication (positive)
  it('succeeds if authentication is valid', async () => {
    let wentThrough = false;
    const universalFn = async () => {
      wentThrough = true;
      return new Response('ok');
    };
    const actualFn = wrap(universalFn).with(auth({
      skipAuthorization: true,
    }));

    const payload = {
      tenantIds: ['123'],
    };
    const token = createJWT(payload);
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
    try {
      await actualFn(request, ctx);

      assert.strictEqual(wentThrough, true, 'wrapper succeeded but still blocked request handling');
      assert.deepStrictEqual(ctx.user.token, token);
      assertPartialObjectMatch(ctx.user.payload, {
        tenantIds: ['123'],
      });
    } catch (e) {
      assert.fail(e);
    }
  });

  // smoke test for authentication (negative)
  it('returns 401 if token is signed with the wrong key', async () => {
    let wentThrough = false;
    const universalFn = async () => {
      wentThrough = true;
      return new Response('ok');
    };
    const actualFn = wrap(universalFn).with(auth({
      skipAuthorization: true,
    }));

    const payload = {
      tenantIds: ['123'],
    };
    const token = createJWT(payload);
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: 'different' } };
    await assert.rejects(
      () => actualFn(request, ctx),
      (e) => {
        assert.strictEqual(wentThrough, false, 'wrapper did not block request handling');
        assert.strictEqual(e.statusCode, 401);
        assert.strictEqual(e.message, 'Unauthorized');
        return true;
      },
    );
  });

  // smoke test for authorization (positive)
  it('succeeds if users is member of tenant', async () => {
    let wentThrough = false;
    const universalFn = async () => {
      wentThrough = true;
      return new Response('ok');
    };
    const actualFn = wrap(universalFn).with(auth());

    mockSpace('test.findmy.media', '123');
    const token = createJWT({
      tenantIds: ['123'],
    });
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-space-host': 'test.findmy.media',
      },
    });
    const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
    try {
      await actualFn(request, ctx);

      assert.strictEqual(wentThrough, true, 'wrapper succeeded but still blocked request handling');
      assert.deepStrictEqual(ctx.tenant, {
        spaceHost: 'test.findmy.media',
        spaceId: '123',
      });
    } catch (e) {
      assert.fail(e);
    }
  });

  // smoke test for authorization (negative)
  it('returns 403 if user is not a member of tenant', async () => {
    let wentThrough = false;
    const universalFn = async () => {
      wentThrough = true;
      return new Response('ok');
    };
    const actualFn = wrap(universalFn).with(auth());

    mockSpace('test.findmy.media', '123');
    const token = createJWT({
      tenantIds: ['456'],
    });
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-space-host': 'test.findmy.media',
      },
    });
    const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
    await assert.rejects(
      () => actualFn(request, ctx),
      (e) => {
        assert.strictEqual(wentThrough, false, 'wrapper did not block request handling');
        assert.strictEqual(e.statusCode, 403);
        assert.strictEqual(e.message, 'Forbidden');
        return true;
      },
    );
  });
});
