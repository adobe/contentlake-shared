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
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export * from './mock.js';

/**
 * @typedef InvocationResponse
 * @property {number} status
 * @property {Object | undefined} data
 */

export class FunctionRunner {
  #client;

  #log;

  /**
   * Creates a Function runner
   * @param {Object | undefined} config the configuration
   */
  constructor(config) {
    this.#client = config?.lambdaClient || new LambdaClient(config);
    this.#log = config?.log || console;
  }

  async #invokeFunctionInternal(name, payload, type) {
    this.#log.debug('Invoking function', { name, payload, type });
    const result = await this.#client.send(
      new InvokeCommand({
        InvocationType: type,
        FunctionName: name,
        Payload: JSON.stringify(payload),
      }),
    );
    this.#verifyResult(result, name);
    return result;
  }

  /**
   * Invokes a function
   * @param {string} name the name of the function to invoke
   * @param {Record<string,any>} payload the payload for the invocation
   * @returns {Promise<void>} when the invocation completes
   */
  async invokeFunction(name, payload) {
    await this.#invokeFunctionInternal(name, payload, 'Event');
  }

  /**
   * Invokes a function and returns the response
   * @param {string} name the name of the lambda function to invoke
   * @param {Record<string,any>} payload the payload for the invocation
   * @returns {Promise<any>} the result of the invocation
   */
  async invokeFunctionWithResponse(name, payload) {
    const result = await this.#invokeFunctionInternal(
      name,
      payload,
      'RequestResponse',
    );
    const data = this.#parseResponsePayload(result.Payload, name);
    this.#log.debug('Successfully retrieved response', data);

    if (data.status >= 400) {
      const resultData = FunctionRunner.#resultData(result, data);
      const err = new Error('Invalid response from function');
      err.responseStatus = data.status;
      err.status = 502;
      err.detail = `Invalid response from function: ${JSON.stringify(
        resultData,
      )}`;
      throw err;
    }
    return data;
  }

  /**
   * @param {import('@aws-sdk/client-lambda').InvokeCommandOutput} result
   * @param {any} data
   */
  static #resultData(result, data) {
    return {
      status: result.StatusCode,
      logs: result.LogResult,
      error: result.FunctionError,
      data,
    };
  }

  /**
   * Verifies the result and will throw an exception if an error was
   * returned from the function invocation
   * @param {import('@aws-sdk/client-lambda').InvokeCommandOutput} result
   * @param {string} functionName
   */
  #verifyResult(result, functionName) {
    if (![200, 202, 204].includes(result.StatusCode)) {
      const resultData = FunctionRunner.#resultData(
        result,
        this.#parseResponsePayload(result, functionName),
      );
      this.#log.warn('Invalid result from function invocation', resultData);
      const err = new Error('Invalid result from function invocation');
      err.status = 502;
      err.detail = `Invalid result from function invocation: ${JSON.stringify(
        resultData,
      )}`;
      throw err;
    }
  }

  /**
   * @param {Uint8Array} payload
   * @param {string} functionName
   */
  #parseResponsePayload(payload, functionName) {
    let data;
    try {
      data = Buffer.from(payload).toString();
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
    } catch (err) {
      this.#log.warn('Unable to parse response from function', {
        functionName,
        data,
      });
    }
    return data;
  }
}
