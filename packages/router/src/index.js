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
import routington from 'routington';
import { RestError } from '@adobe/contentlake-shared-rest-error';

/**
 * Function for handling a routes inside Franklin / Content Lake services
 * @callback Handler
 * @param {Request} req the request
 * @param {Record<string,string>} [params] the parameters parsed from the request
 * @param {import('@adobe/helix-universal').UniversalContext} [context] the context of the request
 * @returns {Promise<Response|Object>} the response from the request
 */

export class Router {
  methods = {};

  /**
   *
   * @param {string} method
   * @param {string} path
   * @param {Handler} handler
   */
  addRoute(method, path, handler) {
    if (!this.methods[method]) {
      this.methods[method] = routington();
    }
    this.methods[method].define(path)[0].handler = handler;
  }

  /**
   *
   * @param {string} path
   * @param {Handler} handler
   */
  delete(path, handler) {
    this.addRoute('DELETE', path, handler);
    return this;
  }

  /**
   *
   * @param {string} path
   * @param {Handler} handler
   */
  get(path, handler) {
    this.addRoute('GET', path, handler);
    return this;
  }

  /**
   *
   * @param {string} path
   * @param {Handler} handler
   */
  post(path, handler) {
    this.addRoute('POST', path, handler);
    return this;
  }

  /**
   *
   * @param {string} path
   * @param {Handler} handler
   */
  put(path, handler) {
    this.addRoute('PUT', path, handler);
    return this;
  }

  /**
   * Handles the specified request
   * @param {Request} request
   * @param {import('@adobe/helix-universal').UniversalContext} context
   * @returns {Promise<Response>}
   */
  async handle(request, context) {
    const log = context.log || console;
    const { method } = request;
    let suffix = context.pathInfo?.suffix;
    if (!suffix || suffix === '') {
      suffix = '/';
    }
    log.debug(`-> ${method} ${suffix}`);
    const start = Date.now();
    /**
     * @type {Response}
     */
    let response;
    if (this.methods[request.method]) {
      const match = this.methods[method].match(suffix);
      if (match?.node?.handler) {
        try {
          response = await match.node.handler(request, match.param, context);
        } catch (err) {
          log.warn('Caught exception from handler', {
            method,
            suffix,
            err,
          });
          response = RestError.toProblemResponse(err, context);
        }
      }
    }
    if (!response) {
      log.debug('No handler found for route', { method, suffix });
      response = RestError.toProblemResponse(
        {
          status: 405,
        },
        context,
      );
    }
    if (!response.status || !response.headers) {
      response = new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    log.debug(
      `<- ${response.status} ${response.headers?.get('Content-Type')} ${
        Date.now() - start
      }ms`,
    );
    return response;
  }
}
