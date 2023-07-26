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
import * as dotenv from 'dotenv';
import { FunctionRunner } from '../src/index.js';

dotenv.config();
const TEST_TIMEOUT = 60000;

const runner = new FunctionRunner();

describe('Functions Integration Tests', async () => {
  it('can invoke function with result', async () => {
    const res = await runner.invokeFunctionWithResponse(
      'helix-services--content-lake-echo-test',
      {
        message: 'ping',
        nested: {
          value: true,
        },
        another: 'key',
      },
    );
    assert.deepStrictEqual(res, {
      event: {
        another: 'key',
        message: 'ping',
        nested: {
          value: true,
        },
      },
      request: {
        headers: {},
        method: 'GET',
        url: 'https://undefined/?message=ping&another=key',
      },
    });
  }).timeout(TEST_TIMEOUT);

  it('can handle error response', async () => {
    await assert.rejects(
      runner.invokeFunctionWithResponse(
        'helix-services--content-lake-echo-test',
        {
          status: 400,
        },
      ),
      { status: 502, responseStatus: 400 },
    );
  }).timeout(TEST_TIMEOUT);

  it('can invoke function via event', async () => {
    await runner.invokeFunction('helix-services--content-lake-echo-test', {
      message: 'ping',
      nested: {
        value: true,
      },
      another: 'key',
    });
  }).timeout(TEST_TIMEOUT);

  it('event fails if not function', async () => {
    assert.rejects(
      runner.invokeFunction('helix-services--i-dont-exist', {
        Descartes: false,
      }),
      { status: 502 },
    );
  });
});
