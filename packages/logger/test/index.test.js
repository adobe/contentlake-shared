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

/* eslint-env mocha */
import { randomUUID } from 'crypto';
import assert from 'assert';
import { Request } from '@adobe/fetch';
import wrap from '@adobe/helix-shared-wrap';
import { RestError } from '@adobe/content-lake-commons';
import { logger, OpsLog } from '../src/index.js';

function mockContext(suffix) {
  return {
    pathInfo: {
      suffix,
    },
    env: {},
    invocation: {
      id: randomUUID(),
    },
    log: console,
  };
}

describe('OpsLog class', async () => {
  it('Create new OpsLog', () => {
    const jobId = randomUUID();
    const requestId = randomUUID();
    const opsLog = new OpsLog(context.log, jobId, requestId);
    assert.strictEqual(opsLog.jobId, jobId);
    assert.strictEqual(opsLog.requestId, requestId);
    assert.strictEqual(opsLog.getLogHeader(), `JOB: ${jobId} REQ: ${requestId}`);
  });
  it('Add a step to the opsLog header', () => {
    const jobId = randomUUID();
    const requestId = randomUUID();
    const opsLog = new OpsLog(context.log, jobId, requestId);
    opsLog.setStep('dispatch');
    assert.strictEqual(opsLog.jobId, jobId);
    assert.strictEqual(opsLog.requestId, requestId);
    assert.strictEqual(opsLog.getLogHeader(), `JOB: ${jobId} REQ: ${requestId} STEP: dispatch`);
  });
  it('Check all log types work without an error', () => {
    const jobId = randomUUID();
    const requestId = randomUUID();
    const opsLog = new OpsLog(context.log, jobId, requestId);
    assert.strictEqual(opsLog.getLogHeader(), `JOB: ${jobId} REQ: ${requestId}`);

    opsLog.error('error');
    opsLog.warn('warn');
    opsLog.info('info');
    opsLog.debug('debug');
    opsLog.info(); // check empty message works too
  });
  it('Trace not supported', () => {
    const jobId = randomUUID();
    const requestId = randomUUID();
    const opsLog = new OpsLog(context.log, jobId, requestId);
    assert.strictEqual(opsLog.getLogHeader(), `JOB: ${jobId} REQ: ${requestId}`);

    try {
      opsLog.trace('error');
      assert.fail('trace should not be supported');
    } catch (error) {
      assert.strictEqual(error.message, 'opsLog.trace is not a function');
    }
  });

  it('tests logger wrapper function', async () => {
    const jobId = randomUUID();
    const requestId = randomUUID();

    function run(request, context) {
      // check setting a step works
      context.log.setStep('dispatch');
      // check all logs work
      context.log.info('Lambda started');
      context.log.error('Lambda failed');
      context.log.warn('Lambda warning');
      assert.strictEqual(context.log.jobId, jobId);
      assert.strictEqual(context.log.requestId, requestId);
      assert.strictEqual(context.log.getLogHeader(), `JOB: ${jobId} REQ: ${requestId} STEP: dispatch`);
      return new Response('Lambda started', { status: 200 });
    }

    const main = wrap(run)
      .with(logger);

    const resp = await main(
      new Request('https://localhost/', {
        method: 'POST',
        headers: {
          'x-request-id': requestId,
          'x-job-id': jobId,
        },
        body: JSON.stringify({}),
      }),
      mockContext('/'),
    );
    assert.strictEqual(resp.status, 200);
  });
  it('jobId and requestId not required', async () => {
    function run() {
      return new Response('Lambda started', { status: 200 });
    }

    const main = wrap(run)
      .with(logger);

    const resp = await main(
      new Request('https://localhost/', {}),
      mockContext('/'),
    );
    assert.strictEqual(resp.status, 200);
  });
  it('tests logger wrapper function works with 400 RestError', async () => {
    const jobId = randomUUID();
    const requestId = randomUUID();

    function run() {
      return RestError.toProblemResponse(new RestError(400, 'Missing job id'));
    }
    const main = wrap(run)
      .with(logger);

    const resp = await main(
      new Request('https://localhost/', {
        method: 'GET',
        headers: {
          'x-request-id': requestId,
          'x-job-id': jobId,
        },
      }),
      mockContext('/'),
    );
    assert.strictEqual(resp.status, 400);
    const body = await resp.json();
    assert.strictEqual(body.detail, 'Missing job id');
  });
  it('tests logger wrapper function works with 5xx RestError', async () => {
    const jobId = randomUUID();
    const requestId = randomUUID();

    function run() {
      return RestError.toProblemResponse(new RestError(504, 'Function timed out'));
    }
    const main = wrap(run)
      .with(logger);

    const resp = await main(
      new Request('https://localhost/', {
        method: 'GET',
        headers: {
          'x-request-id': requestId,
          'x-job-id': jobId,
        },
      }),
      mockContext('/'),
    );
    assert.strictEqual(resp.status, 504);
    const body = await resp.json();
    assert.strictEqual(body.detail, 'Function timed out');
  });
  it('tests logger wrapper function works with non recognized error', async () => {
    const jobId = randomUUID();
    const requestId = randomUUID();

    function run() {
      return new Error('Something went wrong');
    }
    const main = wrap(run)
      .with(logger);

    const resp = await main(
      new Request('https://localhost/', {
        method: 'GET',
        headers: {
          'x-request-id': requestId,
          'x-job-id': jobId,
        },
      }),
      mockContext('/'),
    );
    assert.strictEqual(resp.message, 'Something went wrong');
  });
  it('tests logger wrapper function works with custom error with a status', async () => {
    const jobId = randomUUID();
    const requestId = randomUUID();

    function run() {
      const error = new Error('Something went wrong');
      error.status = 500;
      return error;
    }
    const main = wrap(run)
      .with(logger);

    const resp = await main(
      new Request('https://localhost/', {
        method: 'GET',
        headers: {
          'x-request-id': requestId,
          'x-job-id': jobId,
        },
      }),
      mockContext('/'),
    );
    // error gets mapped to RestError
    assert.strictEqual(resp.status, 500);
    const body = await resp.json();
    assert.strictEqual(body.detail, 'Something went wrong');
  });
});
