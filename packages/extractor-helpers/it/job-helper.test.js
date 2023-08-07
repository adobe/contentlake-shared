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
import assert from 'assert';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { SettingsStore } from '../src/settings.js';
import { JobHelper } from '../src/job-helper.js';

dotenv.config();

const settingsStore = new SettingsStore(process.env);
const jobHelper = new JobHelper(settingsStore);
const sources = [];
let sourceId;
let jobId;

describe('JobHelper Integration Tests', () => {
  beforeEach(async () => {
    sourceId = randomUUID();
    await settingsStore.putSettings({
      sourceId,
    });
    sources.push(sourceId);
  });
  afterEach(async () => settingsStore.deleteSettings(sourceId));

  describe('full', () => {
    beforeEach(async () => {
      jobId = await jobHelper.start(sourceId, JobHelper.JOB_TYPE.FULL);
    });

    it('can complete', async () => {
      await jobHelper.complete(jobId, sourceId, 'test-cursor');

      assert.ok(jobHelper.shouldStop(jobId));

      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.ok(currentSettings.currentJobStarted);
      delete currentSettings.currentJobStarted;
      assert.ok(currentSettings.lastJobDone);
      delete currentSettings.lastJobDone;
      assert.deepStrictEqual(currentSettings, {
        currentJobStatus: JobHelper.JOB_STATUS.COMPLETE,
        cursor: 'test-cursor',
        sourceId,
      });
    });

    it('can start another full job after completing', async () => {
      await jobHelper.complete(jobId, sourceId, 'test-cursor');

      const currentJobId = await jobHelper.start(
        sourceId,
        JobHelper.JOB_TYPE.FULL,
      );
      assert.ok(currentJobId);

      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.ok(currentSettings.currentJobStarted);
      delete currentSettings.currentJobStarted;
      assert.ok(currentSettings.lastJobDone);
      delete currentSettings.lastJobDone;
      assert.deepStrictEqual(currentSettings, {
        currentJobId,
        currentJobStatus: JobHelper.JOB_STATUS.RUNNING,
        sourceId,
        cursor: 'test-cursor',
      });
    });

    it('can stop', async () => {
      await jobHelper.stop(jobId, sourceId);

      assert.ok(jobHelper.shouldStop(jobId));

      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.ok(currentSettings.currentJobStarted);
      delete currentSettings.currentJobStarted;
      assert.deepStrictEqual(currentSettings, {
        currentJobStatus: JobHelper.JOB_STATUS.STOPPED,
        sourceId,
      });
    });

    it('can start another full job after stopping', async () => {
      await jobHelper.stop(jobId, sourceId);

      const currentJobId = await jobHelper.start(
        sourceId,
        JobHelper.JOB_TYPE.FULL,
      );
      assert.ok(currentJobId);

      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.ok(currentSettings.currentJobStarted);
      delete currentSettings.currentJobStarted;
      assert.deepStrictEqual(currentSettings, {
        currentJobId,
        currentJobStatus: JobHelper.JOB_STATUS.RUNNING,
        sourceId,
      });
    });

    it('cannot start another full job', async () => {
      await assert.rejects(
        () => jobHelper.start(sourceId, JobHelper.JOB_TYPE.FULL),
        { status: 409 },
      );
    });

    it('can start start update job', async () => {
      const updateJobId = await jobHelper.start(
        sourceId,
        JobHelper.JOB_TYPE.UPDATE,
      );
      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.ok(currentSettings.currentJobStarted);
      delete currentSettings.currentJobStarted;
      assert.deepStrictEqual(currentSettings, {
        updateJobId,
        sourceId,
        currentJobStatus: JobHelper.JOB_STATUS.RUNNING,
        currentJobId: jobId,
      });
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      jobId = await jobHelper.start(sourceId, JobHelper.JOB_TYPE.UPDATE);
    });

    it('can complete', async () => {
      await jobHelper.complete(jobId, sourceId, 'test-cursor');

      assert.ok(jobHelper.shouldStop(jobId));

      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.ok(currentSettings.lastJobDone);
      delete currentSettings.lastJobDone;
      assert.deepStrictEqual(currentSettings, {
        cursor: 'test-cursor',
        sourceId,
      });
    });

    it('can start another update job after completing', async () => {
      await jobHelper.complete(jobId, sourceId, 'test-cursor');

      const updateJobId = await jobHelper.start(
        sourceId,
        JobHelper.JOB_TYPE.UPDATE,
      );
      assert.ok(updateJobId);

      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.ok(currentSettings.lastJobDone);
      delete currentSettings.lastJobDone;
      assert.deepStrictEqual(currentSettings, {
        updateJobId,
        sourceId,
        cursor: 'test-cursor',
      });
    });

    it('can stop', async () => {
      await jobHelper.stop(jobId, sourceId);

      assert.ok(jobHelper.shouldStop(jobId));

      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.deepStrictEqual(currentSettings, {
        sourceId,
      });
    });

    it('can start another update job after stopping', async () => {
      await jobHelper.stop(jobId, sourceId);

      const updateJobId = await jobHelper.start(
        sourceId,
        JobHelper.JOB_TYPE.UPDATE,
      );
      assert.ok(updateJobId);

      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.deepStrictEqual(currentSettings, {
        updateJobId,
        sourceId,
      });
    });

    it('cannot start another update job', async () => {
      await assert.rejects(
        () => jobHelper.start(sourceId, JobHelper.JOB_TYPE.UPDATE),
        { status: 409 },
      );
    });

    it('can start start full job', async () => {
      const currentJobId = await jobHelper.start(
        sourceId,
        JobHelper.JOB_TYPE.FULL,
      );
      const currentSettings = await settingsStore.getSettings(sourceId);
      assert.ok(currentSettings.currentJobStarted);
      delete currentSettings.currentJobStarted;
      assert.deepStrictEqual(currentSettings, {
        currentJobId,
        sourceId,
        currentJobStatus: JobHelper.JOB_STATUS.RUNNING,
        updateJobId: jobId,
      });
    });
  });
});
