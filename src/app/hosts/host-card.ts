import { Component, computed, input } from '@angular/core';
import { isDefaultLabel } from '../../../shared/labels';
import type { Job, Runner } from '../../../shared/snapshot';
import { prKeyOfJob, PrHighlight } from '../core/pr-focus';
import { RunnerRow } from './runner-row';


/** One runner host: utilization bar and a row per busy or offline runner; idle ones are only counted. */
@Component({
  selector: 'app-host-card',
  host: { class: 'block' },
  imports: [PrHighlight, RunnerRow],
  template: `
    <section class="rounded-xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <header class="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 class="font-semibold">{{ host() }}</h2>
        @for (label of classLabels(); track label) {
          <span class="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{{ label }}</span>
        }
        <span class="ml-auto text-sm tabular-nums text-zinc-500">
          {{ busy() }} busy · {{ online() - busy() }} idle
          @if (offline()) {
            · <span class="text-red-600">{{ offline() }} offline</span>
          }
        </span>
      </header>
      <div class="h-1 bg-zinc-100 dark:bg-zinc-800">
        <div class="h-1 bg-amber-500 transition-all" [style.width.%]="online() ? (busy() / online()) * 100 : 0"></div>
      </div>
      @if (shown().length === 0) {
        <p class="px-4 py-6 text-center text-sm text-zinc-400">All runners idle</p>
      }
      <ul class="divide-y divide-zinc-100 dark:divide-zinc-800">
        @for (r of shown(); track r.id) {
          <li [appPrHighlight]="prKey(jobFor(r))"><app-runner-row [runner]="r" [job]="jobFor(r)" /></li>
        }
      </ul>
    </section>
  `,
})
export class HostCard {
  readonly host = input.required<string>();
  readonly runners = input.required<Runner[]>();
  readonly jobs = input.required<Map<number, Job>>();

  protected readonly online = computed(() => this.runners().filter((r) => r.status === 'online').length);
  protected readonly busy = computed(() => this.runners().filter((r) => r.busy).length);
  protected readonly offline = computed(() => this.runners().length - this.online());
  protected readonly shown = computed(() => this.runners().filter((r) => r.busy || r.status === 'offline'));
  /** Custom labels of this host's runners (e.g. "gpu"), shown next to its name. */
  protected readonly classLabels = computed(() =>
    [...new Set(this.runners().flatMap((r) => r.labels))].filter((l) => !isDefaultLabel(l)).sort(),
  );

  protected readonly prKey = prKeyOfJob;

  protected jobFor(r: Runner): Job | undefined {
    return r.jobId === null ? undefined : this.jobs().get(r.jobId);
  }
}
