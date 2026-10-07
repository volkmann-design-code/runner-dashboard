import { Component, inject, input } from '@angular/core';
import { isDefaultLabel } from '../../../shared/labels';
import type { Job } from '../../../shared/snapshot';
import { Clock } from '../core/clock';
import { DurationPipe } from '../core/duration-pipe';
import { prKeyOfJob, PrHighlight } from '../core/pr-focus';
import { Preferences } from '../core/preferences';
import { ConclusionIcon } from './conclusion-icon';
import { JobSummary } from './job-summary';

/** Queued or recently finished jobs; `kind` picks the right-hand columns. Running jobs show on the host cards. */
@Component({
  selector: 'app-job-list',
  host: { class: 'block' },
  imports: [ConclusionIcon, DurationPipe, JobSummary, PrHighlight],
  template: `
    <section class="rounded-xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <header class="flex items-baseline gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 class="font-semibold">{{ title() }}</h2>
        <span class="text-sm tabular-nums text-zinc-500">{{ jobs().length }}</span>
      </header>
      @if (jobs().length === 0) {
        <p class="px-4 py-6 text-center text-sm text-zinc-400">{{ empty() }}</p>
      }
      <ul class="divide-y divide-zinc-100 dark:divide-zinc-800">
        @for (job of jobs(); track job.id) {
          <li class="flex items-center gap-3 px-4 py-2 text-sm" [appPrHighlight]="prKey(job)">
            @if (kind() === 'recent') {
              <app-conclusion-icon [conclusion]="job.conclusion" />
            }
            <app-job-summary class="flex-1" [job]="job" />
            @switch (kind()) {
              @case ('queued') {
                @for (label of extraLabels(job); track label) {
                  <span class="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{{ label }}</span>
                }
                <span class="w-20 shrink-0 text-right tabular-nums text-zinc-500" title="waiting">{{ job.createdAt | duration: clock.now() }}</span>
              }
              @case ('recent') {
                <span class="hidden shrink-0 text-xs text-zinc-500 sm:inline">{{ runnerLabel(job) }}</span>
                <span class="w-16 shrink-0 text-right tabular-nums text-zinc-500" title="duration">{{ job.startedAt | duration: job.completedAt }}</span>
                <span class="hidden w-20 shrink-0 text-right tabular-nums text-xs text-zinc-400 sm:inline" title="finished">{{ job.completedAt | duration: clock.now() }} ago</span>
              }
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class JobList {
  readonly title = input.required<string>();
  readonly jobs = input.required<Job[]>();
  readonly kind = input.required<'queued' | 'recent'>();
  readonly empty = input('Nothing here');

  protected readonly clock = inject(Clock);
  private readonly preferences = inject(Preferences);

  protected readonly prKey = prKeyOfJob;

  protected extraLabels(job: Job): string[] {
    return job.labels.filter((l) => !isDefaultLabel(l));
  }

  protected runnerLabel(job: Job): string {
    if (!job.runnerName) return '';
    if (job.githubHosted || !this.preferences.showRunnerIds()) return job.runnerHost ?? '';
    return `${job.runnerHost ?? ''} ${job.runnerShortName ?? ''}`.trim();
  }
}
