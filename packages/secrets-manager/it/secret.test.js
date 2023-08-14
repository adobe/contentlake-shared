/*
 * Copyright 2021 Adobe. All rights reserved.
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
import * as dotenv from 'dotenv';
import {
  SecretsManagerClient,
  DeleteSecretCommand,
  ListSecretsCommand,
} from '@aws-sdk/client-secrets-manager';
import { SecretsManager } from '../src/index.js';

dotenv.config();

const SLOW_TEST_TIMEOUT = 5000;

const secretsManager = new SecretsManager({
  secretType: 'it-secret',
  serviceType: 'it-service',
  serviceId: 'it-service-id',
});

describe('Secrets Manager Integration Tests', async () => {
  it('fails on non-existing secret', async () => {
    await assert.rejects(() => secretsManager.getSecret('not-a-secret'));
  });

  it('can create, get and delete secret', async () => {
    const secretId = randomUUID();
    await assert.rejects(() => secretsManager.getSecret(secretId));

    await secretsManager.putSecret(secretId, 'value1');

    let value = await secretsManager.getSecret(secretId);
    assert.strictEqual(value, 'value1');

    await secretsManager.putSecret(secretId, 'value2');

    value = await secretsManager.getSecret(secretId);
    assert.strictEqual(value, 'value2');

    await secretsManager.deleteSecret(secretId);
  }).timeout(SLOW_TEST_TIMEOUT);

  after(async () => {
    const secretManager = new SecretsManagerClient();
    await secretManager
      .send(
        new ListSecretsCommand({
          IncludePlannedDeletion: false,
          MaxResults: 100,
        }),
      )
      .then((res) => {
        Promise.all(
          res.SecretList.filter((secret) => secret.Name.startsWith('/it-secret')).map((secret) => secretManager.send(
            new DeleteSecretCommand({
              SecretId: secret.Name,
            }),
          )),
        );
      });
  });
});
