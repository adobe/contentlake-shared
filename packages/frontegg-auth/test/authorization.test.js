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
import { handleAuthorization } from '../src/authorization.js';
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

describe('authorization', () => {
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

  describe('tenant', () => {
    it('succeeds if users is member of tenant', async () => {
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
        await handleAuth(request, ctx);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('returns 403 if user is not a member of tenant', async () => {
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
        () => handleAuth(request, ctx),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('returns 403 if user token has empty tenantId array', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: [],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      await assert.rejects(
        () => handleAuth(request, ctx),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('returns 403 if user token has no tenantIds in the payload', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({});
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      await assert.rejects(
        () => handleAuth(request, ctx),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('returns 403 if internal context.user is not set', async () => {
      const request = new Request('http://localhost/api');
      // no context.user present
      const ctx = { log };
      await assert.rejects(
        () => handleAuthorization(request, ctx),
        (e) => {
          assert.strictEqual(e.statusCode, 500);
          assert.strictEqual(e.message, 'Internal Server Error');
          return true;
        },
      );
    });

    it('returns 400 if x-space-host header is missing', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      await assert.rejects(
        () => handleAuth(request, ctx),
        (e) => {
          assert.strictEqual(e.statusCode, 400);
          assert.strictEqual(e.message, 'Missing x-space-host header');
          return true;
        },
      );
    });

    it('returns 403 if cannot look up space id', async () => {
      // deliberately not mocking the space
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
      await assert.rejects(
        () => handleAuth(request, ctx),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });
  });

  describe('permissions', () => {
    it('succeeds if user has required permissions', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        permissions: ['contentlake.upload'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        permissions: ['contentlake.upload'],
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('succeeds if user has required permissions (opt.permissions as string)', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        permissions: ['contentlake.upload'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        permissions: 'contentlake.upload',
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('succeeds if user has required permissions (subset of their permissions)', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        permissions: ['contentlake.upload', 'contentlake.admin'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        permissions: ['contentlake.upload'],
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('returns 403 if user does not have the permission', async () => {
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
      const opts = {
        permissions: ['contentlake.upload'],
      };
      await assert.rejects(
        () => handleAuth(request, ctx, opts),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('returns 403 if user does not have all the permissions', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        permissions: ['contentlake.admin'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        permissions: ['contentlake.upload', 'contentlake.admin'],
      };
      await assert.rejects(
        () => handleAuth(request, ctx, opts),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('succeeds if user has required permissions (order does not matter)', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        permissions: ['contentlake.upload', 'contentlake.admin'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        permissions: ['contentlake.admin', 'contentlake.upload'],
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('returns 403 if user does not have the permission (empty permissions array)', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        permissions: [],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        permissions: ['contentlake.upload'],
      };
      await assert.rejects(
        () => handleAuth(request, ctx, opts),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('succeeds if opts.permissions is empty array', async () => {
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
      const opts = {
        permissions: [],
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });
  });

  describe('roles', () => {
    it('succeeds if user has required roles', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        roles: ['Admin'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        roles: ['Admin'],
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('succeeds if user has required roles (opt.roles as string)', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        roles: ['Admin'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        roles: 'Admin',
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('succeeds if user has required roles (subset of their roles)', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        roles: ['Admin', 'Manager'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        roles: ['Admin'],
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('returns 403 if user does not have the role', async () => {
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
      const opts = {
        roles: ['Admin'],
      };
      await assert.rejects(
        () => handleAuth(request, ctx, opts),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('returns 403 if user does not have all the roles', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        roles: ['Admin'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        roles: ['Manager', 'Admin'],
      };
      await assert.rejects(
        () => handleAuth(request, ctx, opts),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('succeeds if user has required roles (order does not matter)', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        roles: ['Manager', 'Admin'],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        roles: ['Admin', 'Manager'],
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });

    it('returns 403 if user does not have the role (empty roles array)', async () => {
      mockSpace('test.findmy.media', '123');
      const token = createJWT({
        tenantIds: ['123'],
        roles: [],
      });
      const request = new Request('http://localhost/api', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-space-host': 'test.findmy.media',
        },
      });
      const ctx = { log, env: { FRONTEGG_JWT_KEY_RS256: PUBLIC_KEY } };
      const opts = {
        roles: ['Admin'],
      };
      await assert.rejects(
        () => handleAuth(request, ctx, opts),
        (e) => {
          assert.strictEqual(e.statusCode, 403);
          assert.strictEqual(e.message, 'Forbidden');
          return true;
        },
      );
    });

    it('succeeds if opts.roles is empty array', async () => {
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
      const opts = {
        roles: [],
      };
      try {
        await handleAuth(request, ctx, opts);

        assert.deepStrictEqual(ctx.tenant, {
          spaceHost: 'test.findmy.media',
          spaceId: '123',
        });
      } catch (e) {
        assert.fail(e);
      }
    });
  });
});
