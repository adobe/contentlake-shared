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

import jwt from 'jsonwebtoken';
import { AuthenticationError, ErrorResponse } from './error.js';

/* Reads the JWT access token from the request and throws 401 if not found */
function getTokenFromRequest(request, context) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    throw new AuthenticationError(context, 'Authorization header is missing');
  }
  const [type, token] = authHeader.trim().split(' ');
  if (type !== 'Bearer') {
    throw new AuthenticationError(context, 'Authorization header is not of type Bearer');
  }
  if (!token) {
    throw new AuthenticationError(context, 'Authorization header is missing token');
  }
  return token;
}

/* Returns if the request is expected to use Frontegg development environment */
function isFronteggDevEnv(request) {
  // same as in Fastly VCL
  // https://github.com/adobe/content-lake-fastly/blob/f17a2f209db5e010bd55887d46efadacac664a92/shared/auth.vcl#L8-L14
  const origin = request.headers.get('origin') || request.headers.get('referer');

  return origin && origin.match(/http:\/\/localhost:3000\/?/);
}

/* Authentication logic */
// eslint-disable-next-line no-unused-vars
export async function handleAuthentication(request, context, opts = {}) {
  if (opts.skipAuthentication) {
    return;
  }

  // make sure to overwrite any existing user on the object
  delete context.user;

  const token = getTokenFromRequest(request, context);
  const dev = isFronteggDevEnv(request);

  const key = dev ? context.env?.DEV__FRONTEGG_JWT_KEY_RS256 : context.env?.FRONTEGG_JWT_KEY_RS256;
  if (!key) {
    throw new ErrorResponse(context, 500, 'Missing configuration: FRONTEGG_JWT_KEY_RS256 or DEV__FRONTEGG_JWT_KEY_RS256');
  }

  let payload;

  try {
    payload = jwt.verify(token, key);
  } catch (e) {
    throw new AuthenticationError(context, `Invalid access token: ${e.message}`);
  }

  context.user = {
    payload,
    token,
  };
}
