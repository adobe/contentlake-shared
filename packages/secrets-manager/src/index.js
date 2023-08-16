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

import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

export * from './mock.js';

/**
 * @typedef {Object} SecretsScope Defines the scope under which the secrets will be persisted
 * @property {string} secretType
 * @property {string} serviceType
 * @property {string} serviceId
 */

export class SecretsManager {
  /**
   * @type {SecretsManagerClient}
   */
  #client;

  /**
   * @type {string}
   */
  #namespace;

  /**
   * Creates a Secrets Manager
   * @param {SecretsScope} scope the scope for the secrets
   * @param {SecretsManagerClient} [client] the client to use instead of constructing a new instance
   */
  constructor(scope, client) {
    this.#client = client || new SecretsManagerClient();

    const missing = ['secretType', 'serviceType', 'serviceId'].filter(
      (field) => !scope[field],
    );
    if (missing.length > 0) {
      throw new Error(`Missing secret scope fields: [${missing.join(',')}]`);
    }
    this.#namespace = `/${scope.secretType}/${scope.serviceType}/${scope.serviceId}`;
  }

  /**
   * Makes the full key for the secret
   * @param {string} id the id of the secret
   * @returns {string} the full key for accessing the secret
   */
  #makeKey(id) {
    return `${this.#namespace}/${id}`;
  }

  /**
   *
   * @param {string} id the id of the secret to create
   * @param {string} secret the secret to save
   */
  async #upsertSecret(id, secret) {
    const SecretId = this.#makeKey(id);
    try {
      await this.#client.send(
        new DescribeSecretCommand({
          SecretId,
        }),
      );
      await this.#client.send(
        new PutSecretValueCommand({
          SecretId,
          SecretString: secret,
        }),
      );
    } catch (err) {
      await this.#client.send(
        new CreateSecretCommand({
          Name: SecretId,
          SecretString: secret,
        }),
      );
    }
  }

  /**
   * Deletes the specified secret
   * @param {string} id  the id of the secret to delete
   */
  async deleteSecret(id) {
    await this.#client.send(
      new DeleteSecretCommand({
        SecretId: this.#makeKey(id),
      }),
    );
  }

  /**
   * Gets the specified secret
   * @param {string} id the id of the secret to retrieve
   * @returns {Promise<string>} the secret value
   */
  async getSecret(id) {
    const command = new GetSecretValueCommand({
      SecretId: this.#makeKey(id),
    });
    const res = await this.#client.send(command);
    return res.SecretString;
  }

  /**
   * Puts or creates the specified configuration
   * @param {string} id the id of the secret to persist
   * @param {string} secret the secret
   */
  async putSecret(id, secret) {
    await this.#upsertSecret(id, secret);
  }
}
