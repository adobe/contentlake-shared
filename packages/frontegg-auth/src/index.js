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

import { handleAuthentication } from './authentication.js';
import { handleAuthorization } from './authorization.js';

/**
 * @summary Frontegg authentication and authorization library for Asset Catalog
 * @description Frontegg authentication and authorization library for Asset Catalog (contentlake).
 *
 * Features:
 * - Frontegg Bearer access token validation (authentication)
 * - Tenant membership validation for Asset Catalog based on `x-space-host` header
 * - Custom `permissions` and `roles` authorization
 * - Provides user information to application code in context.user (token, payload)
 * - Provides tenant information to application code in context.tenant (spaceId, companyId)
 *
 * This requires [@adobe/helix-universal](https://github.com/adobe/helix-universal) 4.2.0 or newer.
 *
 * #### Usage
 *
 * There are two ways to use this library:
 * 1. simply plug in `auth()` as wrapper function to run as middleware for all requests
 * 2. explicitly call `handleAuth()` inside your own routing logic for
 *    only the requests that require the frontegg authentication and authorization
 *
 * ##### `auth()` middleware
 * If the entire function and all its requests should be guarded
 * by the authentication and authorization middleware, add the
 * wrapper function `auth`:
 *
 * ```js
 * import wrap from '@adobe/helix-shared-wrap';
 * import { auth } from '@adobe/asset-compute-auth';
 *
 * async function run(request, context) {
 *   // your main function
 * }
 *
 * export const main = wrap(run)
 *   .with(auth, { permissions: 'some-permission' })
 *   .with(helixStatus);
 * ```
 *
 * ##### `handleAuth()`
 *
 * Invoke `await handleAuth()` inside your own routing logic for the authentication check
 * at the start of request handling:
 *
 * ```js
 * import { handleAuth } from '@adobe/asset-compute-auth';
 *
 * // your main function
 * async function main(request, context) {
 *   if (context.pathInfo === '/api-one') {
 *      // this api path should use the authentication middleware
 *      await handleAuth(request, context, {
 *        permissions: 'some-permission',
 *      });
 *
 *     // your code
 *
 *   } else if (context.pathInfo === '/api-two') {
 *      // this api path should NOT use the authentication middleware
 *
 *     // your code
 *   }
 * }
 *
 * ```
 * @module auth
 */

/**
 * Authentication and authorization configuration object.
 *
 * @typedef {object} AuthOptions
 *
 * @property {(string|string[])} permissions Frontegg permission(s) the user is required to have
 *
 * @property {(string|string[])} roles Frontegg role(s) the user is required to have.
 *   Warning: it is highly preferred to use `permissions` instead of roles in code, as that allows
 *   for more flexibility in defining and changing roles.

 * @property {boolean} skip If `true`, skip all authentication and authorization checks.
 *   Only intended for development & testing.
 * @property {boolean} skipAuthorization If `true`, skip any authorization checks. A valid access
 *   token in the request is still required. Only intended for development & testing.
 */

/**
 * Authentication and authorization handler for Asset Catalog using Frontegg
 * tokens and space tenants.
 *
 * This will throw an error if authentication or authorization fails
 * which will result in a 401 or 403 response (with @adobe/helix-universal).
 * If it succeeds, it will simply return. It provides no return value.
 *
 * On success, user and tenant information is added to `context`:
 * * `context.user`
 * * `context.tenant`
 *
 * @param {Request} request the request
 * @param {UniversalContext} context the universal context
 * @param {AuthOptions} [opts] Authentication and authorization options
 */
export async function handleAuth(request, context, opts = {}) {
  if (opts.skip) {
    return;
  }

  await handleAuthentication(request, context, opts);
  await handleAuthorization(request, context, opts);
}

/**
 * Wraps a function with a Frontegg authentication and authorization middleware.
 * Invokes {@link handleAuth} for all requests.
 *
 * ```
 * export const main = wrap(run)
 *    // minimal
 *   .with(auth);
 *
 *    // alternatively with options
 *   .with(auth, { permissions: 'some-permission' });
 * ```
 *
 * @param {UniversalFunction} fn the universal function
 * @param {AuthOptions} [opts] Options
 * @returns {function} an universal function with the added middleware
 */
export function auth(fn, opts = {}) {
  return async (request, context) => {
    // on auth failures, this will throw an error which helix-universal 4.2.0+
    // will catch and turn into a 401 or 403 http response.
    await handleAuth(request, context, opts);

    return fn(request, context);
  };
}
