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

import { randomUUID } from 'crypto';
import { RestError } from '@adobe/content-lake-commons';

const PROP_CURRENT_JOB_ID = 'currentJobId';
const PROP_UPDATE_JOB_ID = 'updateJobId';

/**
 * Helper for Extractor Jobs
 */
export class JobHelper {
  #settingsStore;

  static JOB_TYPE = Object.seal({
    FULL: 'FULL::',
    UPDATE: 'UPDATE::',
  });

  static JOB_STATUS = Object.seal({
    RUNNING: 'RUNNING',
    STOPPED: 'STOPPED',
    COMPLETE: 'COMPLETE',
  });

  /**
   * @param {import("./settings.js").SettingsObject} sourceSettings
   * @param {string} jobId
   * @returns {boolean} True if the jobId matches the jobId of the same job tye
   */
  static isCurrentRunningJob(sourceSettings, jobId) {
    if (this.isUpdateJob(jobId)) {
      return sourceSettings.updateJobId === jobId;
    } else {
      return sourceSettings.currentJobId === jobId;
    }
  }

  /**
   * @param {string} jobId
   * @returns {boolean} true if the jobId is for an update job, false otherwise
   */
  static isUpdateJob(jobId) {
    return jobId.startsWith(JobHelper.JOB_TYPE.UPDATE);
  }

  /**
   *
   * @param {import("./settings.js").SettingsStore} settingsStore
   */
  constructor(settingsStore) {
    this.#settingsStore = settingsStore;
  }

  /**
   * Gets the settings
   * @param {string} sourceId
   */
  async #getSettings(sourceId) {
    return this.#settingsStore.getSettings(sourceId);
  }

  /**
   * Sets the currentJobId to completed if the passed jobId matches the currentJobId for the source.
   * Otherwise it will update the cursor if the job is an update job.
   *
   * @param {string} jobId
   * @param {string} sourceId
   * @param {string} cursor
   */
  async complete(jobId, sourceId, cursor) {
    const sourceSettings = await this.#getSettings(sourceId);
    if (JobHelper.isCurrentRunningJob(sourceSettings, jobId)) {
      if (JobHelper.isUpdateJob(jobId)) {
        delete sourceSettings.updateJobId;
        sourceSettings.lastJobDone = new Date().toISOString();
      } else {
        delete sourceSettings.currentJobId;
        sourceSettings.currentJobStatus = JobHelper.JOB_STATUS.COMPLETE;
        sourceSettings.lastJobDone = new Date().toISOString();
      }
      sourceSettings.cursor = cursor;
      await this.#settingsStore.putSettings(sourceSettings);
    }
  }

  /**
   * Checks if the job should be stopped
   * @param {string} jobId
   * @param {string} sourceId
   * @returns {Promise<boolean>} true if processing should be stopped, false otherwise
   */
  async shouldStop(jobId, sourceId) {
    if (JobHelper.isUpdateJob(jobId)) {
      return false;
    }
    const sourceSettings = await this.#getSettings(sourceId);
    return !JobHelper.isCurrentRunningJob(sourceSettings, jobId);
  }

  /**
   * Starts a new job returning the jobId or throws an Error if a job of the type is
   * already running for the source
   * @param {string} sourceId
   * @param {string} type the job type to start, should be one of JobHelper.JOB_TYPE
   * @returns {Promise<string>} the jobId
   */
  async start(sourceId, type) {
    let jobId;
    let jobIdProperty;
    const sourceSettings = await this.#getSettings(sourceId);

    if (type === JobHelper.JOB_TYPE.FULL) {
      jobId = `${JobHelper.JOB_TYPE.FULL}${randomUUID()}`;
      jobIdProperty = PROP_CURRENT_JOB_ID;
      sourceSettings.currentJobId = jobId;
      sourceSettings.currentJobStatus = JobHelper.JOB_STATUS.RUNNING;
      sourceSettings.currentJobStarted = new Date().toISOString();
    } else if (type === JobHelper.JOB_TYPE.UPDATE) {
      jobId = `${JobHelper.JOB_TYPE.UPDATE}${randomUUID()}`;
      jobIdProperty = PROP_UPDATE_JOB_ID;
      sourceSettings.updateJobId = jobId;
    } else {
      throw new RestError(400, `Invalid job type ${type}`);
    }

    try {
      await this.#settingsStore.conditionalPutSettings(
        sourceSettings,
        `attribute_not_exists(${jobIdProperty})`,
      );
    } catch (err) {
      throw new RestError(
        409,
        `A job is already running for source ${sourceId} of type ${type}, details ${err}`,
      );
    }
    return jobId;
  }

  /**
   * Stops the currently executing job if the jobId matches the currentJobId
   * @param {string} jobId
   * @param {string} sourceId
   */
  async stop(jobId, sourceId) {
    const sourceSettings = await this.#getSettings(sourceId);
    if (JobHelper.isCurrentRunningJob(sourceSettings, jobId)) {
      if (JobHelper.isUpdateJob(jobId)) {
        delete sourceSettings.updateJobId;
      } else {
        sourceSettings.currentJobStatus = JobHelper.JOB_STATUS.STOPPED;
        delete sourceSettings.currentJobId;
      }
      await this.#settingsStore.putSettings(sourceSettings);
    }
  }
}
