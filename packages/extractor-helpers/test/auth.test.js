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
/* eslint-disable no-unused-expressions */

import assert from 'assert';
import { promisify } from 'util';
import { BaseOauthAuthenticator } from '../src/auth.js';

const wait = promisify(setTimeout);

class MockOauthAuthenticator extends BaseOauthAuthenticator {
  refreshCount = 0;

  async getAuthenticationUrl() {
    return Promise.resolve(
      `http://localhost:8080/auth?redirect=${this.redirectUri}`,
    );
  }

  async refreshAccessToken() {
    if (this.refreshToken === 'valid') {
      this.refreshCount += 1;
      this.updateTokens({
        accessToken: 'valid',
        expiration: new Date(Date.now() + 6000),
      });
      return Promise.resolve();
    } else {
      throw new Error('Invalid refresh token');
    }
  }

  // eslint-disable-next-line class-methods-use-this
  handleCallback(params) {
    if (params.code === 'valid') {
      this.updateTokens({
        accessToken: 'valid',
        refreshToken: 'valid',
        expiration: new Date(Date.now() + 6000),
      });
      return Promise.resolve();
    } else {
      throw new Error('Invalid auth code');
    }
  }
}

describe('OAuth Authenticator Tests', () => {
  it('requires configuration', async () => {
    let caught;
    try {
      const authenticator = new MockOauthAuthenticator();
      assert.ok(authenticator);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
  });

  it('requires source / redirect', async () => {
    let caught;
    try {
      const authenticator = new MockOauthAuthenticator({});
      assert.ok(authenticator);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
  });

  it('can check authentication', async () => {
    const authenticator = new MockOauthAuthenticator({
      redirectUri: 'http://findmy.media',
      sourceId: 'test',
    });
    assert(authenticator.requiresReauthentication());
    authenticator.refreshToken = 'valid';
    assert(!authenticator.requiresReauthentication());
  });

  it('ensure requires authentication', async () => {
    const authenticator = new MockOauthAuthenticator({
      redirectUri: 'http://findmy.media',
      sourceId: 'test',
    });
    assert(authenticator.requiresReauthentication());
    let err;
    try {
      await authenticator.ensureAuthenticated();
    } catch (caught) {
      err = caught;
    }
    assert.ok(err);
  });

  it('can ensure authenticated', async () => {
    const authenticator = new MockOauthAuthenticator({
      redirectUri: 'http://findmy.media',
      sourceId: 'test',
      refreshToken: 'valid',
    });
    let refreshed = await authenticator.ensureAuthenticated();
    assert.ok(refreshed);
    refreshed = await authenticator.ensureAuthenticated();
    assert.ok(!refreshed);
  });

  it('can perform auth', async () => {
    const authenticator = new MockOauthAuthenticator({
      redirectUri: 'http://findmy.media',
      sourceId: 'test',
    });
    assert.ok(authenticator.requiresReauthentication());

    const authUrl = await authenticator.getAuthenticationUrl();
    assert.strictEqual(
      authUrl,
      'http://localhost:8080/auth?redirect=http://findmy.media',
    );

    await authenticator.handleCallback({ code: 'valid' });
    assert.strictEqual(authenticator.requiresReauthentication(), false);
    assert.strictEqual(authenticator.refreshToken, 'valid');

    await authenticator.ensureAuthenticated();
    assert.strictEqual(authenticator.refreshCount, 0);
    await wait(2000);
    await authenticator.ensureAuthenticated();
    assert.strictEqual(authenticator.refreshCount, 1);
  }).timeout(5000);

  it('can get access token', async () => {
    const authenticator = new MockOauthAuthenticator({
      redirectUri: 'http://findmy.media',
      refreshToken: 'valid',
      sourceId: 'test',
    });
    const accessToken = await authenticator.getAccessToken();
    assert.ok(accessToken);
  });

  it('can call getters', async () => {
    const authenticator = new MockOauthAuthenticator({
      redirectUri: 'http://findmy.media',
      refreshToken: 'valid',
      sourceId: 'test',
    });
    const accessToken = await authenticator.getAccessToken();
    assert.strictEqual(authenticator.accessToken, accessToken);
    assert.ok(authenticator.expiration);
    assert.strictEqual(authenticator.redirectUri, 'http://findmy.media');
    assert.strictEqual(authenticator.refreshToken, 'valid');
    assert.strictEqual(authenticator.sourceId, 'test');
  });

  it('throws on abstract methods', async () => {
    const authenticator = new BaseOauthAuthenticator({
      redirectUri: 'http://findmy.media',
      refreshToken: 'valid',
      sourceId: 'test',
    });

    let caught;
    try {
      await authenticator.getAuthenticationUrl();
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    caught = undefined;

    try {
      await authenticator.handleCallback({});
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    caught = undefined;

    try {
      await authenticator.refreshAccessToken();
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
  });
});
