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

/* eslint-disable max-classes-per-file */

// HTTP standard reason phrases. We do not care about them,
// and HTTP/2 no longer supports them. Only the code is relevant to us.
const HTTP_STD_REASON = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  500: 'Internal Server Error',
};

export class ErrorResponse extends Error {
  constructor(context, statusCode, message) {
    // for which status codes should we include a detailed message in the client response?
    const hideMessage = statusCode >= 500
      || statusCode === 401
      || statusCode === 403;

    const responseMsg = hideMessage ? HTTP_STD_REASON[statusCode] : message;
    super(responseMsg);

    // this makes helix-universal return an http response with the given status code
    this.statusCode = statusCode;

    // log level representing client failure (4xx = warn) and server failure (5xx = error)
    const logLevel = statusCode >= 500 ? 'error' : 'warn';
    context.log[logLevel](`[auth] ${statusCode}: ${message}`);
  }
}

export class AuthenticationError extends ErrorResponse {
  constructor(context, message) {
    super(context, 401, message);
  }
}

export class AuthorizationError extends ErrorResponse {
  constructor(context, message) {
    super(context, 403, message);
  }
}
