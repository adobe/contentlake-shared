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

import { RestError } from '@adobe/contentlake-shared-rest-error';
import wrap from '@adobe/helix-shared-wrap';
import { helixStatus } from '@adobe/helix-status';
import { logger } from '@adobe/helix-universal-logger';
import { RequestHandlerInternal } from './internal.js';

/**
 * @callback HandlerFn
 * @param {Record<string,any>} event the event to handle
 * @param {import('@adobe/helix-universal').UniversalContext} context
 *  the current context
 * @returns {Promise<Response>} the response from handling the request
 */

/**
 * A "wrapper" that handles requests from both HTTP POSTs and SQS. The service interface
 * provides capabilities that allow the Lambda function to be executed and configured
 * through HTTP requests either using POST parameters or via Queue Records
 */
export class RequestHandler {
  /**
   * @type {import("@adobe/helix-shared-wrap").WrapFunction | undefined}
   */
  #wrapFn;

  /**
   * @type {Record<string,HandlerFn>}
   */
  #handlers = {};

  /**
   * Registers an action handler, replacing the existing handler (if any)
   * @param {string} action the action name
   * @param {function(any):Promise<Response>} handler the handler function
   * @returns {RequestHandler}
   */
  withHandler(action, handler) {
    this.#handlers[action] = handler;
    return this;
  }

  /**
   * Gets the main function for the extractor
   * @returns {function(Request,UniversalContext):Promise<Response>} the main function
   */
  getMain() {
    let main = wrap(async (request, context) => this.main(request, context));
    if (this.#wrapFn) {
      main = main.with(this.#wrapFn);
    }
    return main.with(helixStatus).with(logger.trace).with(logger);
  }

  /**
   * @param {Request} request
   * @param {import('@adobe/helix-universal').UniversalContext} context
   * @returns {Promise<Response>}
   */
  async main(request, context) {
    const log = context.log || console;
    let res;
    const { method, url } = request;
    const loggableRequest = {
      method,
      url,
      headers: Object.fromEntries(request.headers),
      invocation: context?.invocation,
    };
    const start = Date.now();
    try {
      log.debug(`> ${method} ${url}`);
      log.debug('Handling request', loggableRequest);
      const internalHandler = new RequestHandlerInternal(
        context,
        this.#handlers,
      );
      res = await internalHandler.handle();
    } catch (err) {
      log.warn('Exception handling request', { ...loggableRequest, err });
      res = RestError.toProblemResponse(err, context);
    }
    log.info(`< ${method} ${res.status} ${url} ${Date.now() - start}ms`);
    return res;
  }

  /**
   * Adds an additional wrap function to the invocation
   * @param {import("@adobe/helix-shared-wrap").WrapFunction} fn
   */
  withWrapFunction(fn) {
    this.#wrapFn = fn;
    return this;
  }
}
