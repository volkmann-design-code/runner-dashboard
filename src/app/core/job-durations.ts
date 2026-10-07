import { effect, inject, Injectable } from '@angular/core';
import type { Job } from '../../../shared/snapshot';
import { LiveSnapshot } from './live-snapshot';

const STORAGE_KEY = 'jobDurations';
/** Runs remembered per job; the estimate is their median. */
const RUNS_PER_JOB = 10;
/** Jobs remembered at all; the ones that ran longest ago are forgotten first. */
const MAX_JOBS = 500;

interface Run {
  id: number;
  completedAt: string;
  ms: number;
}

/**
 * Runtimes of past successful jobs, remembered per browser, to estimate how
 * long a running job still needs. Learns from the snapshot's recent jobs, so
 * it only sees jobs that finish while a tab is open (or are still among the
 * recent ones on load). No history for a job: no estimate.
 */
@Injectable({ providedIn: 'root' })
export class JobDurations {
  private readonly runs: Record<string, Run[]> = load();

  constructor() {
    const snapshot = inject(LiveSnapshot).snapshot;
    effect(() => {
      const recent = snapshot()?.recentJobs;
      if (recent && recent.some((j) => this.record(j))) save(this.runs);
    });
  }

  /** Expected total runtime in ms, or null without history. */
  estimate(job: Job): number | null {
    const ms = (this.runs[keyOf(job)] ?? []).map((r) => r.ms).sort((a, b) => a - b);
    if (ms.length === 0) return null;
    const mid = Math.floor(ms.length / 2);
    return ms.length % 2 ? ms[mid] : (ms[mid - 1] + ms[mid]) / 2;
  }

  /** Adds a finished job's runtime; true if the history changed. */
  private record(job: Job): boolean {
    // Failed or cancelled jobs end early and would pull the estimate down.
    if (job.conclusion !== 'success' || !job.startedAt || !job.completedAt) return false;
    const key = keyOf(job);
    const runs = this.runs[key] ?? [];
    if (runs.some((r) => r.id === job.id)) return false;
    const ms = Date.parse(job.completedAt) - Date.parse(job.startedAt);
    if (!(ms > 0)) return false;
    // Newest first; an old job that was already pushed out falls off again.
    const next = [...runs, { id: job.id, completedAt: job.completedAt, ms }]
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, RUNS_PER_JOB);
    if (!next.some((r) => r.id === job.id)) return false;
    this.runs[key] = next;
    return true;
  }
}

/** Matrix jobs carry their matrix values in the name, so each variant gets its own history. */
function keyOf(job: Job): string {
  return [job.org, job.repo, job.workflow, job.name].join('/');
}

function load(): Record<string, Run[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Run[]>;
  } catch {
    return {};
  }
}

function save(runs: Record<string, Run[]>): void {
  const keys = Object.keys(runs);
  if (keys.length > MAX_JOBS) {
    const lastRun = (k: string) => runs[k][0]?.completedAt ?? '';
    keys.sort((a, b) => lastRun(a).localeCompare(lastRun(b)));
    for (const k of keys.slice(0, keys.length - MAX_JOBS)) delete runs[k];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {}
}
