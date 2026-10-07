import { Component, computed, inject, input } from '@angular/core';
import type { Job, Runner } from '../../../shared/snapshot';
import { Clock } from '../core/clock';
import { DurationPipe } from '../core/duration-pipe';
import { JobDurations } from '../core/job-durations';
import { OrgBadges } from '../core/org-badge';
import { JobSummary } from '../jobs/job-summary';

export type RowState = 'busy' | 'queued' | 'idle' | 'offline';

const DOT: Record<RowState, string> = {
  busy: 'animate-pulse bg-amber-500',
  queued: 'bg-zinc-400',
  idle: 'bg-emerald-500',
  offline: 'bg-zinc-400',
};

/**
 * The row layout shared by runner rows and the GitHub-hosted card: state dot,
 * org badge (with several orgs), optional runner ID, then the job with its
 * time, or a short text.
 */
@Component({
  selector: 'app-job-row',
  host: { class: 'flex items-center gap-3 px-4 py-2 text-sm' },
  imports: [DurationPipe, JobSummary],
  template: `
    <span class="size-2.5 shrink-0 rounded-full" [class]="dot()" [title]="state()"></span>
    @if (badge(); as b) {
      <span class="max-w-24 min-w-9 shrink-0 truncate rounded px-1 text-center text-xs font-medium" [class]="b.tone" [title]="org()">{{ b.label }}</span>
    }
    @if (runner(); as r) {
      <span class="w-14 shrink-0 truncate font-mono text-xs text-zinc-500" [title]="r.name">{{ r.shortName }}</span>
    }
    @if (job(); as job) {
      <app-job-summary class="flex-1" [job]="job" />
      @for (label of labels(); track label) {
        <span class="hidden shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 sm:inline dark:bg-zinc-800 dark:text-zinc-300">{{ label }}</span>
      }
      @if (state() === 'queued') {
        <span class="shrink-0 tabular-nums text-zinc-400" title="waiting">{{ job.createdAt | duration: clock.now() }}</span>
      } @else {
        <span class="shrink-0 tabular-nums text-zinc-500" title="running">{{ job.startedAt | duration: clock.now() }}</span>
        @if (remaining(); as r) {
          <span class="hidden shrink-0 tabular-nums text-xs text-zinc-400 sm:inline" [title]="r.title">{{ r.text }}</span>
        }
      }
    } @else {
      <span class="flex-1" [class]="state() === 'busy' ? 'text-zinc-500' : 'text-zinc-400'">{{ text() }}</span>
    }
  `,
})
export class JobRow {
  readonly state = input.required<RowState>();
  /** Org login */
  readonly org = input.required<string>();
  readonly job = input<Job>();
  /** Its short name (RUNNER_NAME_PATTERN's id) is shown when set. */
  readonly runner = input<Pick<Runner, 'name' | 'shortName'> | null>(null);
  readonly labels = input<string[]>([]);
  /** Shown instead of a job. */
  readonly text = input('');

  protected readonly clock = inject(Clock);
  private readonly durations = inject(JobDurations);
  private readonly badges = inject(OrgBadges);

  protected readonly dot = computed(() => DOT[this.state()]);
  protected readonly badge = computed(() => this.badges.of(this.org()));

  /** Estimated time left from past runs of the same job; none without history. */
  protected readonly remaining = computed(() => {
    const job = this.job();
    if (this.state() !== 'busy' || !job?.startedAt) return null;
    const estimate = this.durations.estimate(job);
    if (estimate === null) return null;
    const leftMs = estimate - (this.clock.now() - Date.parse(job.startedAt));
    return {
      text: leftMs > 0 ? `~${minutes(Math.ceil(leftMs / 60_000))} left` : `${minutes(Math.max(1, Math.ceil(-leftMs / 60_000)))} over`,
      title: `usually takes ~${minutes(Math.max(1, Math.round(estimate / 60_000)))} (median of recent successful runs)`,
    };
  });
}

function minutes(m: number): string {
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
