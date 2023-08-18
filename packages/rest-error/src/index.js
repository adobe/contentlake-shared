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
import { Response } from 'node-fetch';

const STATUS_TITLES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Request Too Large',
  414: 'Request-URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  511: 'Network Authentication Required',
};

/**
 * An error class for rfc9457-compliant errors
 */
export class RestError extends Error {
  /**
   * @type {number} The HTTP status code
   */
  status;

  /**
   * @type {Object | undefined} Additional properties to include in the problem
   * response
   */
  additional;

  /**
   * @type {string | undefined} A human-readable explanation
   */
  detail;

  /**
   * @type {string | undefined} URI reference that identifies the specific
      occurrence of the problem.
   */
  instance;

  /**
   * @type {string | undefined} A short, human-readable summary of the problem
      type.  It SHOULD NOT change from occurrence to occurrence of the
      problem
   */
  title;

  /**
   * Construct a new RestError instance
   * @param {number} status the HTTP status code
   * @param {string} [detail] A human-readable explanation
   * @param {Object} [additional] Additional properties to include in the problem response
   */
  constructor(status, detail, additional) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.additional = additional;
  }

  /**
   *
   * @param {string|undefined} initial
   * @param {import('@adobe/helix-universal').UniversalContext} context
   */
  static #getInstanceUri(initial, context) {
    if (initial) {
      return initial;
    }
    const instance = context?.invocation?.requestId || context?.invocation?.id;
    if (instance) {
      return `/invocation/${instance}`;
    }
    return undefined;
  }

  /**
   * Converts the specified error object to a problem response
   * @param {*} err the error to which to convert to a application/problem+json response
   * @param {import('@adobe/helix-universal').UniversalContext} [context] the context
   * @returns a response for the problem
   */
  static toProblemResponse(err, context) {
    let { status } = err;
    if (!status) {
      status = 500;
    }
    return new Response(
      JSON.stringify({
        title: err.title || STATUS_TITLES[status] || 'Unknown Problem',
        status,
        detail: err.detail || err.message,
        instance: RestError.#getInstanceUri(err.instance, context),
        ...(err.additional || {}),
      }),
      {
        headers: {
          'Content-Type': 'application/problem+json',
        },
        status,
      },
    );
  }
}
