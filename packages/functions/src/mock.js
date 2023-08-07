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

/**
 * A mock for the FunctionRunner.
 *
 * Set the property `response` on this class to set the response returned from the
 * function runner.
 *
 * The invocation data can be asserted from the array of invocations.
 *
 * @see {FunctionRunner}
 */
export class MockFunctionRunner {
  /**
   * The invocations performed on this mock
   */
  invocations = [];

  /**
   * the response to return upon invocation
   */
  response;

  async invokeFunctionWithResponse(name, params) {
    this.invocations.push({ name, params });
    return Promise.resolve(this.response);
  }

  async invokeFunction(name, params) {
    this.invocations.push({ name, params });
    return Promise.resolve();
  }

  /**
   * Resets the mock to it's original state, should be called between each test
   */
  reset() {
    this.invocations = [];
    this.response = undefined;
  }
}
