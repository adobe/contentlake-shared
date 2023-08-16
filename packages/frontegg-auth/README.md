# Content Lake Shared - frontegg-auth

> Frontegg authentication and authorization library for Asset Catalog

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![NPM Version](https://img.shields.io/npm/v/@adobe/contentlake-shared-frontegg-auth.svg)](https://www.npmjs.com/package/@adobe/contentlake-shared-frontegg-auth)
[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)
[![Known Vulnerabilities](https://snyk.io/test/github/adobe/contentlake-shared/badge.svg?targetFile=packages/frontegg-auth/package.json)](https://snyk.io/test/github/adobe/contentlake-shared?targetFile=packages/frontegg-auth/package.json)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-frontegg-auth
```

TODO: code example

## Development
### Frontegg token examples

Below are the payloads of different Frontegg JWT tokens. Note that all names, emails and ids have been replaced with randomized values.

#### User token – `userToken`

Normal access token for human users received via the OAuth login flow.

```
{
  "sub": "626de2ed-2bf1-4314-bd95-3bcbc232e6ef",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true,
  "metadata": {},
  "roles": [
    "Admin"
  ],
  "permissions": [
    "fe.connectivity.*",
    "fe.secure.*",
    "contentlake.repository.manage"
  ],
  "tenantId": "d0d17542-7899-41a1-8f35-11a701bf1047",
  "tenantIds": [
    "d0d17542-7899-41a1-8f35-11a701bf1047",
    "8d4f6887-6786-433e-bfe2-baad0ea869f9",
  ],
  "profilePictureUrl": "https://www.gravatar.com/avatar/1234567890?d=https://ui-avatars.com/api/John+Doe/128/random",
  "sid": "0e4dc1fe-677b-43fe-ba0c-363532247cd1",
  "type": "userToken",
  "aud": "4230c66f-5558-4365-863d-737ba8ffc373",
  "iss": "https://app-abcdefghijkl.frontegg.com",
  "iat": 1688054464,
  "exp": 1688659264
}
```

Notes:
- `sub` is the user id used in Frontegg apis to identify the user
- `sid` seems to be a unique value not used anywhere else ?

#### User API token

API tokens that users can create for themselves.

Also called _User-specific API Token_ in the [API reference](https://docs.frontegg.com/reference/userapitokensv1controller_createtenantapitoken) and _Personal Token_ in the [Admin Portal](https://docs.frontegg.com/docs/personal-tokens).

The final JWT will look slightly different depending on what [type of credential](https://docs.frontegg.com/docs/m2m-tokens#client-credentials-vs-access-tokens) is chosen for M2M, _Client Credentials_ or _Access Tokens_.


Using client credentials kind – `userApiToken`:

```
{
  "sub": "7141a5a2-a2c7-4fd1-bbb9-089455ba1e82",
  "email": "john@example.com",
  "userMetadata": {},
  "tenantId": "d0d17542-7899-41a1-8f35-11a701bf1047",
  "roles": [
    "Admin"
  ],
  "permissions": [
    "fe.connectivity.*",
    "fe.secure.*",
    "contentlake.repository.manage"
  ],
  "metadata": {},
  "createdByUserId": "626de2ed-2bf1-4314-bd95-3bcbc232e6ef",
  "type": "userApiToken",
  "userId": "626de2ed-2bf1-4314-bd95-3bcbc232e6ef",
  "aud": "4230c66f-5558-4365-863d-737ba8ffc373",
  "iss": "https://app-abcdefghijkl.frontegg.com",
  "iat": 1688129488,
  "exp": 1688734288
}
```

Using access token kind – `userAccessToken`:

```
{
  "sub": "b94c0200-6d9b-4c9f-a612-96be8dcb98b0",
  "type": "userAccessToken",
  "tenantId": "d0d17542-7899-41a1-8f35-11a701bf1047",
  "userId": "626de2ed-2bf1-4314-bd95-3bcbc232e6ef",
  "roles": [
    "FETCH-ROLES-BY-API"
  ],
  "permissions": [
    "FETCH-PERMISSIONS-BY-API"
  ],
  "aud": "4230c66f-5558-4365-863d-737ba8ffc373",
  "iss": "https://app-abcdefghijkl.frontegg.com",
  "iat": 1688128620,
  "exp": 1688733420
}
```

Notes:
- `userId` is the same as the user who owns the personal token
- `createdByUserId` is the same as the user who owns the personal token and created it (only for `userApiToken`)
- `sub` is different from the user and seems to be a unique value
- `aud` is the same as for user tokens and tenant api tokens

#### Tenant token

Service users/tokens that admins can create for a specific tenant.

Also called _Tenant API Token_ in the [API reference](https://docs.frontegg.com/reference/tenantapitokensv2controller_createtenantapitoken) and _API Token_ in the [Admin Portal](https://docs.frontegg.com/docs/admin-portal-api-tokens).

The final JWT will look slightly different depending on what [type of credential](https://docs.frontegg.com/docs/m2m-tokens#client-credentials-vs-access-tokens) is chosen for M2M, _Client Credentials_ or _Access Tokens_.

Using client credentials kind – `tenantApiToken`:

```
{
  "sub": "98c866a0-f7a4-4a3d-963b-ee5c144aecf8",
  "tenantId": "d0d17542-7899-41a1-8f35-11a701bf1047",
  "roles": [
    "ReadOnly"
  ],
  "permissions": [
    "fe.connectivity.read.*",
    "fe.secure.read.*"
  ],
  "metadata": {},
  "createdByUserId": "626de2ed-2bf1-4314-bd95-3bcbc232e6ef",
  "type": "tenantApiToken",
  "aud": "4230c66f-5558-4365-863d-737ba8ffc373",
  "iss": "https://app-abcdefghijkl.frontegg.com",
  "iat": 1688129655,
  "exp": 1688734455
}
```

Using access token kind – `tenantAccessToken`:

```
{
  "sub": "c82f30f5-56db-40dd-90ad-3e67bce17962",
  "type": "tenantAccessToken",
  "tenantId": "d0d17542-7899-41a1-8f35-11a701bf1047",
  "roles": [
    "FETCH-ROLES-BY-API"
  ],
  "permissions": [
    "FETCH-PERMISSIONS-BY-API"
  ],
  "aud": "4230c66f-5558-4365-863d-737ba8ffc373",
  "iss": "https://app-abcdefghijkl.frontegg.com",
  "iat": 1688125033,
  "exp": 1688128633
}
```

#### Vendor token – `vendor`

The powerful token for the entire Frontegg backoffice. Not to be used or exposed by customers.

```
{
  "scopes": [],
  "type": "vendor",
  "vendorId": "f153bb24-132b-4e28-93e2-4184e2ec5fb7",
  "iat": 1688118456,
  "exp": 1688204856
}
```