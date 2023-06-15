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

import { AuthorizationError, ErrorResponse } from './error.js';

/** Authorization logic */
export async function handleAuthorization(request, context, opts = {}) {
  if (opts.skipAuthorization) {
    return;
  }

  // make sure to overwrite any existing tenant on the object
  delete context.tenant;

  const user = context.user?.payload;
  if (!user) {
    throw new ErrorResponse(context, 500, 'Missing context.user.payload');
  }

  const spaceHost = request.headers.get('x-space-host');
  if (!spaceHost) {
    throw new ErrorResponse(context, 400, 'Missing x-space-host header');
  }

  // TODO: proper space id lookup
  // TODO: get company id
  const spaceId = process.env[`MOCK_SPACE_${spaceHost}`];
  if (!spaceId) {
    throw new AuthorizationError(context, `Missing configuration: MOCK_SPACE_${spaceHost}`);
  }
  if (!user.tenantIds?.includes(spaceId)) {
    throw new AuthorizationError(context, `User is not a member of space ${spaceHost} (id: ${spaceId})`);
  }

  if (opts.permissions) {
    const permissions = Array.isArray(opts.permissions) ? opts.permissions : [opts.permissions];
    const missingPermissions = permissions.filter((p) => !user.permissions?.includes(p));
    if (missingPermissions.length > 0) {
      throw new AuthorizationError(context, `User is missing required permissions: ${missingPermissions.join(', ')}`);
    }
  }

  if (opts.roles) {
    const roles = Array.isArray(opts.roles) ? opts.roles : [opts.roles];
    const missingRoles = roles.filter((p) => !user.roles?.includes(p));
    if (missingRoles.length > 0) {
      throw new AuthorizationError(context, `User is missing required role: ${missingRoles.join(', ')}`);
    }
  }

  context.tenant = {
    spaceHost,
    spaceId,
  };
}
