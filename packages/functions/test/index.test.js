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
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { FunctionRunner, MockFunctionRunner } from '../src/index.js';

const lambdaClient = mockClient(LambdaClient);

describe('Functions Unit Tests', () => {
  describe('mock', () => {
    it('exports mock', () => {
      assert.ok(MockFunctionRunner);
    });

    const mockMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(new MockFunctionRunner()),
    );
    const realMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(new FunctionRunner()),
    );
    realMethods.forEach((method) => {
      it(`Mock has method ${method}`, () => {
        assert.ok(mockMethods.includes(method));
      });
    });
  });

  describe('invokeFunction', () => {
    it('can invoke function', async () => {
      lambdaClient.on(InvokeCommand).resolves({
        StatusCode: 200,
      });
      const runner = new FunctionRunner({ lambdaClient });
      await runner.invokeFunction('test', {});
    });

    it('handles invoke failures', async () => {
      lambdaClient.on(InvokeCommand).resolves({
        StatusCode: 400,
      });
      const runner = new FunctionRunner({ lambdaClient });
      await assert.rejects(runner.invokeFunction('test', {}), {
        status: 502,
      });
    });
  });

  describe('invokeFunctionWithResponse', () => {
    it('can invoke function with response', async () => {
      lambdaClient.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: '{"message":"Hello World"}',
      });
      const runner = new FunctionRunner({ lambdaClient });
      const response = await runner.invokeFunctionWithResponse('test', {});
      assert.deepStrictEqual(response, { message: 'Hello World' });
    });

    it('handles double wrapped responses', async () => {
      lambdaClient.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: '"{\\"message\\":\\"Hello World\\"}"',
      });
      const runner = new FunctionRunner({ lambdaClient });
      const response = await runner.invokeFunctionWithResponse('test', {});
      assert.deepStrictEqual(response, { message: 'Hello World' });
    });

    it('handles response failures', async () => {
      lambdaClient.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: '{"status":429,"detail":"Hello World"}',
      });
      const runner = new FunctionRunner({ lambdaClient });
      await assert.rejects(runner.invokeFunctionWithResponse('test', {}), {
        status: 502,
        responseStatus: 429,
      });
    });
  });
});
