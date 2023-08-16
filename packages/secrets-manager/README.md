# Content Lake Shared - Secrets Manager

> Supports storing and retrieving custom secrets

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-secrets-manager
```

Use with:

```
import { Secrets } from '@adobe/contentlake-shared-secrets-manager';


const secretsManager = new SecretsManager({
  secretType: 'test-secret-type',
  serviceType: 'test-service',
  serviceId: 'test-service-id',
});

const secret = await secretsManager.getSecret('someid');
```

## Integration Tests

The integration tests for this module can be run with:

```
npm run test:integration
```

To do this you will need a `.env` file with:

```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
```