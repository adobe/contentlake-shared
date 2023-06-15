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
 * @summary Authentication and authorization library for Asset Catalog
 * @description Authentication and authorization library for Asset Catalog.
 *
 * This requires `@adobe/helix-universal` 4.2.0 or newer.
 *
 * #### Usage
 *
 * There are two ways to use this library:
 * 1. `auth` wrapper function to run as middleware for all requests
 * 2. `handleAuth` function to call inside your own routing logic for
 *    only the requests that need this authentication and authorization
 *
 * ##### `auth` wrapper function
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
 *   .with(auth({ permissions: 'some-permission' }))
 *   .with(helixStatus);
 * ```
 *
 * ##### `handleAuth` function
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
 * @module
 */

/**
 * Authentication and authorization configuration object.
 *
 * @typedef {object} AuthOptions
 *
 * @property {(string|string[])} permissions Frontegg permission(s) the user is required to have

 * @property {(string|string[])} roles Frontegg role(s) the user is required to have.
 *   Warning: it is highly preferred to use `permissions` instead of roles in code, as that allows
 *   for more flexibility in defining and changing roles.

 * @property {boolean} skipAuthentication Skip authentication entirely.
 *   Only intended for development & testing.
 * @property {boolean} skipAuthorization Skip authorization entirely.
 *   Only intended for development & testing.
 */

/**
 * Authentication and authorization handler for content-lake using Frontegg
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
  await handleAuthentication(request, context, opts);
  await handleAuthorization(request, context, opts);
}

/**
 * A helix-shared-wrap middleware (wrapper function) that handles authentication
 * & authorization for all requests by calling {@link handleAuth}.
 *
 * Note that this must be invoked before being passed to `wrap().with(fn)`, unlike
 * other wrapper functions, in order to support passing of custom options:
 * ```
 * export const main = wrap(run)
 *    // minimal
 *   .with(auth());
 *
 *    // alternatively with options
 *   .with(auth({ permissions: 'some-permission' }));
 * ```
 *
 * @param {AuthOptions} [opts] Options
 * @returns {function} wrapper for use with @adobe/helix-shared-wrap
 */
export function auth(opts = {}) {
  if (typeof opts === 'function') {
    throw new Error('Developer error: auth() must be invoked before being passed to wrap().with(*) and expects an opts object as argument: wrap().with(auth({}))');
  }

  return (func) => async (request, context) => {
    // on auth failures, this will throw an error which helix-universal 4.2.0+
    // will catch and turn into a 401 or 403 http response.
    await handleAuth(request, context, opts);

    return func(request, context);
  };
}
