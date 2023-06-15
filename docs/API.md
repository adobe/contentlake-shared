<a name="module_auth"></a>

## auth
Frontegg authentication and authorization library for Asset Catalog.

Features:
- Frontegg Bearer access token validation (authentication)
- Tenant membership validation for Asset Catalog based on `x-space-host` header
- Custom `permissions` and `roles` authorization
- Provides user information to application code in context.user (token, payload)
- Provides tenant information to application code in context.tenant (spaceId, companyId)

This requires [@adobe/helix-universal](https://github.com/adobe/helix-universal) 4.2.0 or newer.

#### Usage

There are two ways to use this library:
1. simply plug in `auth()` as wrapper function to run as middleware for all requests
2. explicitly call `handleAuth()` inside your own routing logic for
   only the requests that require the frontegg authentication and authorization

##### `auth()` middleware
If the entire function and all its requests should be guarded
by the authentication and authorization middleware, add the
wrapper function `auth`:

```js
import wrap from '@adobe/helix-shared-wrap';
import { auth } from '@adobe/asset-compute-auth';

async function run(request, context) {
  // your main function
}

export const main = wrap(run)
  .with(auth({ permissions: 'some-permission' }))
  .with(helixStatus);
```

##### `handleAuth()`

Invoke `await handleAuth()` inside your own routing logic for the authentication check
at the start of request handling:

```js
import { handleAuth } from '@adobe/asset-compute-auth';

// your main function
async function main(request, context) {
  if (context.pathInfo === '/api-one') {
     // this api path should use the authentication middleware
     await handleAuth(request, context, {
       permissions: 'some-permission',
     });

    // your code

  } else if (context.pathInfo === '/api-two') {
     // this api path should NOT use the authentication middleware

    // your code
  }
}

```

**Summary**: Frontegg authentication and authorization library for Asset Catalog  

* [auth](#module_auth)
    * _static_
        * [.handleAuth(request, context, [opts])](#module_auth.handleAuth)
        * [.auth([opts])](#module_auth.auth) ⇒ <code>function</code>
    * _inner_
        * [~AuthOptions](#module_auth..AuthOptions) : <code>object</code>

<a name="module_auth.handleAuth"></a>

### auth.handleAuth(request, context, [opts])
Authentication and authorization handler for content-lake using Frontegg
tokens and space tenants.

This will throw an error if authentication or authorization fails
which will result in a 401 or 403 response (with @adobe/helix-universal).
If it succeeds, it will simply return. It provides no return value.

On success, user and tenant information is added to `context`:
* `context.user`
* `context.tenant`

**Kind**: static method of [<code>auth</code>](#module_auth)  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>Request</code> | the request |
| context | <code>UniversalContext</code> | the universal context |
| [opts] | <code>AuthOptions</code> | Authentication and authorization options |

<a name="module_auth.auth"></a>

### auth.auth([opts]) ⇒ <code>function</code>
A helix-shared-wrap middleware (wrapper function) that handles authentication
& authorization for all requests by calling [handleAuth](handleAuth).

Note that this must be invoked before being passed to `wrap().with(fn)`, unlike
other wrapper functions, in order to support passing of custom options:
```
export const main = wrap(run)
   // minimal
  .with(auth());

   // alternatively with options
  .with(auth({ permissions: 'some-permission' }));
```

**Kind**: static method of [<code>auth</code>](#module_auth)  
**Returns**: <code>function</code> - wrapper for use with @adobe/helix-shared-wrap  

| Param | Type | Description |
| --- | --- | --- |
| [opts] | <code>AuthOptions</code> | Options |

<a name="module_auth..AuthOptions"></a>

### auth~AuthOptions : <code>object</code>
Authentication and authorization configuration object.

**Kind**: inner typedef of [<code>auth</code>](#module_auth)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| permissions | <code>string</code> \| <code>Array.&lt;string&gt;</code> | Frontegg permission(s) the user is required to have |
| roles | <code>string</code> \| <code>Array.&lt;string&gt;</code> | Frontegg role(s) the user is required to have.   Warning: it is highly preferred to use `permissions` instead of roles in code, as that allows   for more flexibility in defining and changing roles. |
| skip | <code>boolean</code> | If `true`, skip all authentication and authorization checks.   Only intended for development & testing. |
| skipAuthorization | <code>boolean</code> | If `true`, skip any authorization checks. A valid access   token in the request is still required. Only intended for development & testing. |

