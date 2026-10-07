import { Component, computed, input } from '@angular/core';
import type { Job } from '../../../shared/snapshot';
import { prKeyOfJob, PrHighlight } from '../core/pr-focus';
import { JobRow } from './job-row';

/**
 * Jobs on GitHub's own runners, queued and running, in one section: GitHub
 * does not list its hosted runners, so there are no runner rows to show.
 */
@Component({
  selector: 'app-github-card',
  host: { class: 'block' },
  imports: [JobRow, PrHighlight],
  template: `
    <section class="rounded-xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <header class="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 class="font-semibold">GitHub-hosted</h2>
        <span class="ml-auto text-sm tabular-nums text-zinc-500">{{ running() }} running · {{ queued() }} queued</span>
      </header>
      @if (jobs().length === 0) {
        <p class="px-4 py-6 text-center text-sm text-zinc-400">No job on GitHub's runners</p>
      }
      <ul class="divide-y divide-zinc-100 dark:divide-zinc-800">
        @for (job of jobs(); track job.id) {
          <li [appPrHighlight]="prKey(job)">
            <app-job-row
              [state]="job.status === 'in_progress' ? 'busy' : 'queued'"
              [org]="job.org"
              [job]="job"
              [labels]="job.labels"
            />
          </li>
        }
      </ul>
    </section>
  `,
})
export class GithubCard {
  readonly jobs = input.required<Job[]>();

  protected readonly running = computed(() => this.jobs().filter((j) => j.status === 'in_progress').length);
  protected readonly queued = computed(() => this.jobs().length - this.running());

  protected readonly prKey = prKeyOfJob;

}
