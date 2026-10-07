// All known jobs (self-hosted and GitHub-hosted), fed by webhooks, the
// startup bootstrap and reconcile. GitHub does not guarantee delivery order,
// so a job never moves back (an "in_progress" arriving after "completed" is
// ignored).

import type { Job } from '../../shared/snapshot.ts';

const RECENT_JOBS = 40;
const HISTORY_WINDOW_MS = 12 * 60 * 60_000;

const RANK: Record<string, number> = { in_progress: 1, completed: 2 }; // others (queued, waiting, …): 0

interface Entry {
  job: Job;
  updatedAt: number;
}

export class JobStore {
  private readonly jobs = new Map<number, Entry>();
  private readonly listeners = new Set<() => void>();

  /** Returns true if the store changed. */
  upsert(job: Job): boolean {
    const known = this.jobs.get(job.id);
    if (known && rank(known.job) > rank(job)) return false;
    if (known && JSON.stringify(known.job) === JSON.stringify(job)) return false;
    this.jobs.set(job.id, { job, updatedAt: Date.now() });
    this.prune();
    for (const listener of this.listeners) listener();
    return true;
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  /** queued / in progress, oldest first */
  active(): Job[] {
    return [...this.jobs.values()]
      .map((e) => e.job)
      .filter((j) => j.status !== 'completed')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** finished, newest first */
  recent(): Job[] {
    return [...this.jobs.values()]
      .map((e) => e.job)
      .filter((j) => j.status === 'completed')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, RECENT_JOBS);
  }

  /** Active jobs without news for longer than ms: candidates for a missed webhook. */
  staleActive(ms: number): Job[] {
    const cutoff = Date.now() - ms;
    return [...this.jobs.values()]
      .filter((e) => e.job.status !== 'completed' && e.updatedAt < cutoff)
      .map((e) => e.job);
  }

  /** Mark a still-active job as checked, so reconcile does not ask again right away. */
  touch(id: number): void {
    const entry = this.jobs.get(id);
    if (entry) entry.updatedAt = Date.now();
  }

  /** For jobs GitHub no longer knows (deleted run or repo). */
  remove(id: number): void {
    if (this.jobs.delete(id)) for (const listener of this.listeners) listener();
  }

  private prune(): void {
    const keep = new Set(this.recent().map((j) => j.id));
    const cutoff = Date.now() - HISTORY_WINDOW_MS;
    for (const [id, { job }] of this.jobs) {
      if (job.status !== 'completed') continue;
      if (!keep.has(id) || Date.parse(job.completedAt ?? '') < cutoff) this.jobs.delete(id);
    }
  }
}

function rank(job: Job): number {
  return RANK[job.status] ?? 0;
}
