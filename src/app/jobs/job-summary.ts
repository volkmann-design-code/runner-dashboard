import { Component, computed, input } from '@angular/core';
import type { Job } from '../../../shared/snapshot';

/** Two lines: "repo · workflow · job" linking to the job, then branch and PR. */
@Component({
  selector: 'app-job-summary',
  host: { class: 'block min-w-0' },
  template: `
    <a [href]="job().url" target="_blank" rel="noopener" class="block truncate hover:underline">
      <span class="font-medium">{{ job().repo }}</span>
      <span class="text-zinc-500"> · {{ job().workflow }} · </span>
      {{ job().name }}
    </a>
    <div class="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
      @if (job().branch; as branch) {
        <span class="truncate font-mono" [title]="branch">⎇ {{ branch }}</span>
      }
      @if (job().pr; as pr) {
        <a [href]="prUrl()" target="_blank" rel="noopener"
          class="shrink-0 rounded bg-violet-50 px-1 font-medium text-violet-700 hover:underline dark:bg-violet-950 dark:text-violet-300">#{{ pr }}</a>
      }
    </div>
  `,
})
export class JobSummary {
  readonly job = input.required<Job>();

  protected readonly prUrl = computed(() => {
    const j = this.job();
    return `https://github.com/${j.org}/${j.repo}/pull/${j.pr}`;
  });
}
