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
import { JobHelper } from '../src/job-helper.js';
import { MockSettingsStore } from './mocks/settings.js';

describe('JobHelper Unit Tests', () => {
  const settingsStore = new MockSettingsStore();
  const jobHelper = new JobHelper(settingsStore);

  beforeEach(async () => {
    settingsStore.reset();
    await settingsStore.putSettings({
      sourceId: 'test-source',
      currentJobId: 'FULL::test-job',
      currentJobStatus: 'RUNNING',
      currentJobStarted: new Date().toISOString(),
      updateJobId: 'UPDATE::test-job',
    });
  });

  describe('complete', () => {
    it('can complete', async () => {
      await jobHelper.complete('FULL::test-job', 'test-source', 'test-cursor');
      const settings = await settingsStore.getSettings('test-source');
      assert.strictEqual(settings.cursor, 'test-cursor');
      assert.ok(settings.lastJobDone);
      assert.strictEqual(
        settings.currentJobStatus,
        JobHelper.JOB_STATUS.COMPLETE,
      );
    });

    it('complete only updates cursor for update job', async () => {
      await jobHelper.complete(
        'UPDATE::test-job',
        'test-source',
        'test-cursor',
      );
      const settings = await settingsStore.getSettings('test-source');
      assert.strictEqual(settings.cursor, 'test-cursor');
      assert.strictEqual(
        settings.currentJobStatus,
        JobHelper.JOB_STATUS.RUNNING,
      );
    });

    it('complete skips non-current job', async () => {
      await jobHelper.complete('FULL::test-job2', 'test-source', 'test-cursor');
      const settings = await settingsStore.getSettings('test-source');
      assert.ok(!settings.cursor);
      assert.strictEqual(
        settings.currentJobStatus,
        JobHelper.JOB_STATUS.RUNNING,
      );
      assert.ok(!settings.lastJobDone);
    });
  });

  describe('shouldStop', () => {
    it('should not stop when current job', async () => {
      const shouldStop = await jobHelper.shouldStop(
        'FULL::test-job',
        'test-source',
      );
      assert.ok(!shouldStop);
    });

    it('should not stop when update', async () => {
      const shouldStop = await jobHelper.shouldStop(
        'UPDATE::test-job',
        'test-source',
      );
      assert.ok(!shouldStop);
    });

    it('should stop when job stopped', async () => {
      await jobHelper.stop('FULL::test-job', 'test-source');
      const shouldStop = await jobHelper.shouldStop(
        'FULL::test-job',
        'test-source',
      );
      assert.ok(shouldStop);
    });
  });

  describe('start', () => {
    it('can start', async () => {
      await jobHelper.stop('FULL::test-job', 'test-source');
      await jobHelper.start('test-source', 'FULL::');
      const settings = await settingsStore.getSettings('test-source');
      assert.strictEqual(
        settings.currentJobStatus,
        JobHelper.JOB_STATUS.RUNNING,
      );
      assert.notStrictEqual(settings.currentJobId, 'FULL::test-job2');
    });

    it('update always starts', async () => {
      await jobHelper.start('test-source', 'UPDATE::');
      const settings = await settingsStore.getSettings('test-source');
      assert.strictEqual(settings.currentJobId, 'FULL::test-job');
    });

    it('cannot start with running job', async () => {
      settingsStore.conditionalFail = true;
      await assert.rejects(() => jobHelper.start('test-source', 'FULL::'), {
        status: 409,
      });
    });

    it('cannot start with invalid type', async () => {
      await assert.rejects(() => jobHelper.start('test-source', 'NOT A TYPE'), {
        status: 400,
      });
    });
  });

  describe('stop', () => {
    it('can stop', async () => {
      await jobHelper.stop('FULL::test-job', 'test-source');
      const settings = await settingsStore.getSettings('test-source');
      assert.strictEqual(
        settings.currentJobStatus,
        JobHelper.JOB_STATUS.STOPPED,
      );
    });

    it('can stop update job', async () => {
      await jobHelper.stop('UPDATE::test-job', 'test-source');
      const settings = await settingsStore.getSettings('test-source');
      assert.ok(!settings.updateJobId);
      assert.ok(!settings.lastJobDone);
    });

    it('stop skips update job', async () => {
      await jobHelper.stop('UPDATE::test-job', 'test-source');
      const settings = await settingsStore.getSettings('test-source');
      assert.strictEqual(
        settings.currentJobStatus,
        JobHelper.JOB_STATUS.RUNNING,
      );
      assert.ok(!settings.lastJobDone);
    });

    it('stop skips non-current job', async () => {
      await jobHelper.stop('FULL::test-job2', 'test-source');
      const settings = await settingsStore.getSettings('test-source');
      assert.strictEqual(
        settings.currentJobStatus,
        JobHelper.JOB_STATUS.RUNNING,
      );
      assert.ok(!settings.lastJobDone);
    });
  });
});
