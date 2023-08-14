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
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import assert from 'assert';
import { mockClient } from 'aws-sdk-client-mock';
import { MockSecretsManager, SecretsManager } from '../src/index.js';

const secretsManagerClient = mockClient(SecretsManagerClient);

const VALID_SCOPE = {
  secretType: 'test-secret-type',
  serviceType: 'test-service',
  serviceId: 'test-service-id',
};
const manager = new SecretsManager(VALID_SCOPE, secretsManagerClient);
describe('SecretsManager Unit Tests', () => {
  beforeEach(() => {
    secretsManagerClient.reset();
  });

  describe('mock', () => {
    it('exports mock', () => {
      assert.ok(MockSecretsManager);
    });

    const mockMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(new MockSecretsManager()),
    );
    const realMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(new MockSecretsManager()),
    );
    realMethods.forEach((method) => {
      it(`Mock has method ${method}`, () => {
        assert.ok(mockMethods.includes(method));
      });
    });
  });

  it('can get manager', () => {
    assert.ok(manager);
  });

  describe('invalid scope', () => {
    ['secretType', 'serviceType', 'serviceId'].forEach((field) => {
      it(`will fail without ${field}`, () => {
        assert.throws(() => {
          const invalidScope = JSON.parse(JSON.stringify(VALID_SCOPE));
          delete invalidScope[field];
          // eslint-disable-next-line no-new
          new SecretsManager(invalidScope);
        });
      });
    });
  });

  it('can get secret', async () => {
    secretsManagerClient
      .on(GetSecretValueCommand)
      .resolves({ SecretString: 'test-secret' });
    const resp = await manager.getSecret('test-id');
    assert.strictEqual(resp, 'test-secret');
  });

  it('can put existing secret', async () => {
    let param;
    secretsManagerClient.on(DescribeSecretCommand).resolves({
      SecretId: 'test-id',
    });
    secretsManagerClient.on(PutSecretValueCommand).callsFake((input) => {
      param = input;
    });
    await manager.putSecret('test-id', 'test-secret');
    assert.strictEqual(
      param.SecretId,
      '/test-secret-type/test-service/test-service-id/test-id',
    );
    assert.strictEqual(param.SecretString, 'test-secret');
  });

  it('can put new secret', async () => {
    let param;
    secretsManagerClient.on(DescribeSecretCommand).rejects('does not exist');
    secretsManagerClient.on(CreateSecretCommand).callsFake((input) => {
      param = input;
    });
    await manager.putSecret('test-id', 'test-secret');
    assert.strictEqual(
      param.Name,
      '/test-secret-type/test-service/test-service-id/test-id',
    );
    assert.strictEqual(param.SecretString, 'test-secret');
  });

  it('can delete secret', async () => {
    let param;
    secretsManagerClient.on(DeleteSecretCommand).callsFake((input) => {
      param = input;
    });
    await manager.deleteSecret('test-id');
    assert.strictEqual(
      param.SecretId,
      '/test-secret-type/test-service/test-service-id/test-id',
    );
  });
});
