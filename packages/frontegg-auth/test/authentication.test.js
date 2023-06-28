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
import { handleAuth } from '../src/index.js';
import { assertPartialObjectMatch } from './utils.js';
import { createJWT, PUBLIC_KEY } from './jwt.js';

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

describe('authentication', () => {
  it('succeeds if authentication is valid', async () => {
    const payload = {
      tenantIds: ['123'],
    };
    const token = createJWT(payload);
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    try {
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };

      await handleAuth(request, ctx, {
        skipAuthorization: true,
      });

      assert.deepStrictEqual(ctx.user.token, token);
      assertPartialObjectMatch(ctx.user.payload, {
        tenantIds: ['123'],
      });
    } catch (e) {
      assert.fail(e);
    }
  });

  it('returns 401 if Authorization header is missing', async () => {
    const request = new Request('http://localhost/api');
    await assert.rejects(
      () => handleAuth(request, { log }),
      (e) => {
        assert.strictEqual(e.statusCode, 401);
        assert.strictEqual(e.message, 'Unauthorized');
        return true;
      },
    );
  });

  it('returns 401 if Authorization header is illformed', async () => {
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: 'incorrect',
      },
    });
    await assert.rejects(
      () => handleAuth(request, { log }),
      (e) => {
        assert.strictEqual(e.statusCode, 401);
        assert.strictEqual(e.message, 'Unauthorized');
        return true;
      },
    );
  });

  it('returns 401 if Authorization header is not of type Bearer', async () => {
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: 'Other token',
      },
    });
    await assert.rejects(
      () => handleAuth(request, { log }),
      (e) => {
        assert.strictEqual(e.statusCode, 401);
        assert.strictEqual(e.message, 'Unauthorized');
        return true;
      },
    );
  });

  it('returns 401 if Authorization header has no token', async () => {
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: 'Bearer',
      },
    });
    await assert.rejects(
      () => handleAuth(request, { log }),
      (e) => {
        assert.strictEqual(e.statusCode, 401);
        assert.strictEqual(e.message, 'Unauthorized');
        return true;
      },
    );
  });

  it('returns 401 if Authorization header has invalid token', async () => {
    const pubkey = 'publickey';
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: 'Bearer incorrect',
      },
    });
    await assert.rejects(
      () => handleAuth(request, {
        log,
        env: {
          FRONTEGG_JWT_KEY_RS256: pubkey,
        },
      }),
      (e) => {
        assert.strictEqual(e.statusCode, 401);
        assert.strictEqual(e.message, 'Unauthorized');
        return true;
      },
    );
  });

  it('returns 500 if required key config is missing', async () => {
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${createJWT()}`,
      },
    });
    const ctx = { log, env: { /* empty */ } };
    await assert.rejects(
      () => handleAuth(request, ctx, { skipAuthorization: true }),
      (e) => {
        assert.strictEqual(e.statusCode, 500);
        assert.strictEqual(e.message, 'Internal Server Error');
        return true;
      },
    );
  });

  it('succeeds if authentication is valid [development env]', async () => {
    const payload = {
      tenantIds: ['123'],
    };
    const token = createJWT(payload);
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'http://localhost:3000',
      },
    });
    const ctx = { log, env: { DEV__FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
    try {
      await handleAuth(request, ctx, {
        skipAuthorization: true,
      });

      assert.deepStrictEqual(ctx.user.token, token);
      assertPartialObjectMatch(ctx.user.payload, {
        tenantIds: ['123'],
      });
    } catch (e) {
      assert.fail(e);
    }
  });

  it('returns 401 if token is signed with the wrong key', async () => {
    const payload = {
      tenantIds: ['123'],
    };
    const token = createJWT(payload);
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const ctx = {
      log,
      env: {
        FRONTEGG_JWT_KEY_RS256: 'different',
      },
    };
    await assert.rejects(
      () => handleAuth(request, ctx, { skipAuthorization: true }),
      (e) => {
        assert.strictEqual(e.statusCode, 401);
        assert.strictEqual(e.message, 'Unauthorized');
        return true;
      },
    );
  });

  it('returns 401 if prod token is using the DEV frontegg key', async () => {
    const payload = {
      tenantIds: ['123'],
    };
    const token = createJWT(payload);
    const request = new Request('http://localhost/api', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const ctx = {
      log,
      env: {
        FRONTEGG_JWT_KEY_RS256: 'incorrect',
        DEV__FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY,
      },
    };
    await assert.rejects(
      () => handleAuth(request, ctx, { skipAuthorization: true }),
      (e) => {
        assert.strictEqual(e.statusCode, 401);
        assert.strictEqual(e.message, 'Unauthorized');
        return true;
      },
    );
  });
});
