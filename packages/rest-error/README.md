# Content Lake Shared - REST Error

> Error type for returning [rfc9457](https://datatracker.ietf.org/doc/html/rfc9457) problem responses

This is one of the [Content Lake Shared](https://github.com/adobe/contentlake-shared) libraries.

## Status

[![GitHub license](https://img.shields.io/github/license/adobe/contentlake-shared.svg)](https://github.com/adobe/contentlake-shared/blob/main/LICENSE.txt)

## Usage

Install using:

```
npm install @adobe/contentlake-shared-rest-error
```

Use with:

```
import { RestError } from '@adobe/contentlake-shared-rest-error';

throw new RestError(400, 'Missing some field');
```

### Additional Properties

To add additional requests to the error body provide a third parameter as an Object:

```
throw new RestError(400, 'Missing some field', { fields: ['field1', 'field2']});
```

### Converting to a Problem Response

The static method `toProblemResponse` can convert any object (including RestError objects) into a [rfc9457](https://datatracker.ietf.org/doc/html/rfc9457) problem responses:

```
RestError.toProblemResponse(err);
```

In addition, you can provide a second context parameter from which the method will extract an instance from the invocation:

```
RestError.toProblemResponse(err, context);
```
