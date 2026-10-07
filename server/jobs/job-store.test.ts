import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { job } from '../test/fixtures.ts';
import { JobStore } from './job-store.ts';

describe('JobStore', () => {
  it('never moves a job back', () => {
    const store = new JobStore();
    store.upsert(job({ status: 'completed', conclusion: 'success', completedAt: new Date().toISOString() }));
    assert.equal(store.upsert(job({ status: 'in_progress' })), false);
    assert.equal(store.recent()[0]?.status, 'completed');
    assert.deepEqual(store.active(), []);
  });

  it('reports no change for an identical job', () => {
    const store = new JobStore();
    let changes = 0;
    store.onChange(() => changes++);
    store.upsert(job());
    assert.equal(store.upsert(job()), false);
    assert.equal(changes, 1);
  });

  it('lists active jobs oldest first', () => {
    const store = new JobStore();
    store.upsert(job({ id: 2, createdAt: '2026-01-01T11:00:00Z' }));
    store.upsert(job({ id: 1, createdAt: '2026-01-01T10:00:00Z', status: 'in_progress' }));
    assert.deepEqual(store.active().map((j) => j.id), [1, 2]);
  });

  it('drops finished jobs older than the history window', () => {
    const store = new JobStore();
    store.upsert(job({ id: 1, status: 'completed', completedAt: '2020-01-01T00:00:00Z' }));
    store.upsert(job({ id: 2 })); // any upsert prunes
    assert.deepEqual(store.recent(), []);
  });
});
