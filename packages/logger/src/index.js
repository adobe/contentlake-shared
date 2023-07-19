/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { RestError } from '@adobe/content-lake-commons';
import { randomUUID } from 'crypto';

export class OpsLog {
  #log;

  #logHeader;

  constructor(log, jobId, requestId) {
    this.jobId = jobId;
    this.requestId = requestId;
    this.start = Date.now();

    this.#log = log || console;
  }

  getLogHeader() {
    if (!this.#logHeader) {
      this.#logHeader = `JOB: ${this.jobId} REQ: ${this.requestId}`;
    }
    return this.#logHeader;
  }

  /**
   * [Optional] Set the step name for the log header
   * @param {String} step name of step of AWS lambda function
   */
  setStep(step) {
    this.#logHeader = `${this.getLogHeader()} STEP: ${step}`;
  }

  #logMsg(logFn, msg) {
    if (msg) {
      logFn(`${this.getLogHeader()} MESSAGE: ${msg}`);
    } else {
      logFn(`${this.getLogHeader()}`);
    }
  }

  error(msg) {
    this.#logMsg(this.#log.error, msg);
  }

  warn(msg) {
    this.#logMsg(this.#log.warn, msg);
  }

  info(msg) {
    this.#logMsg(this.#log.info, msg);
  }

  debug(msg) {
    this.#logMsg(this.#log.debug, msg);
  }

  logStart(msg) {
    if (!this.startTime) {
      this.startTime = Date.now();
    }
    this.info(msg || 'Function started');
  }

  /**
   * Default log message at the end of every invocation that hits an error (status >= 400)
   * Not meant to be used directly, only by wrapper
   * @param {*} problem Raw error object
   * @param {*} error Optional in case the client wants to pass in a specially formatted error
   */
  logEndError(problem, error = undefined) {
    const duration = Date.now() - this.startTime;
    // hopefully errors will follow similar structure: https://github.com/adobe/content-lake-commons/blob/main/src/rest-error.js
    // but stay less strict and log entire erroruntil we are synced throughout all repos
    const message = error || JSON.stringify(problem);
    this.#log.error(`${this.getLogHeader()} STATUS: ${problem.status} DURATION (ms): ${duration} MESSAGE: ${message}`);
  }

  /**
   * Default log message at the end of every invocation, not meant to be used directly
   * @param {Object} statusObj Fetch Response object
   */
  logEnd(statusObj) {
    const duration = Date.now() - this.startTime;
    const statusMsg = statusObj?.statusText || 'Function ended';
    this.info(`STATUS: ${statusObj?.status || 202} DURATION (ms): ${duration} MESSAGE: ${statusMsg}`);
  }
}

export function logger(func) {
  return async (...args) => {
    // eslint-disable-next-line prefer-const
    let [params = {}, context = {}] = args;

    const jobIdHeader = params?.headers.get('x-job-id');
    const jobId = jobIdHeader || randomUUID();
    const requestIdHeader = params?.headers.get('x-request-id');
    const requestId = requestIdHeader || randomUUID();
    const opsLog = new OpsLog(context?.log, jobId, requestId);

    context.log = opsLog;
    context.log.logStart();
    if (!jobIdHeader) {
      context.log.debug('No JobId provided in request header, using autogenerated JobId');
    }
    if (!requestIdHeader) {
      context.log.debug('No RequestId provided in request header, using autogenerated RequestId');
    }
    const resp = await func(...args);
    if (resp.status >= 400) {
      let body = resp;
      // should be formatted as a RestError: https://github.com/adobe/content-lake-commons/blob/main/src/rest-error.js
      // read body of response for logging
      try {
        body = await resp.json();
      } catch (e) {
        // ignore
      }
      context.log.logEndError(body);
      return RestError.toProblemResponse(body);
    }
    context.log.logEnd(resp);
    return resp;
  };
}
