import { Component, computed, input } from '@angular/core';
import type { Snapshot } from '../../../shared/snapshot';
import { countsOf } from '../core/counts';

/** Busy / idle / queued / offline counts across all hosts. */
@Component({
  selector: 'app-stats-bar',
  host: { class: 'block' },
  template: `
    <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      @for (stat of stats(); track stat.label) {
        <div class="rounded-xl bg-white px-4 py-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <dt class="text-xs uppercase tracking-wide text-zinc-500">{{ stat.label }}</dt>
          <dd class="text-2xl font-semibold tabular-nums" [class]="stat.tone">{{ stat.value }}</dd>
        </div>
      }
    </dl>
  `,
})
export class StatsBar {
  readonly snapshot = input.required<Snapshot>();

  protected readonly stats = computed(() => {
    const { busy, online, offline, queued } = countsOf(this.snapshot());
    return [
      { label: 'Busy', value: `${busy} / ${online}`, tone: busy ? 'text-amber-600' : '' },
      { label: 'Idle', value: online - busy, tone: 'text-emerald-600' },
      { label: 'Queued', value: queued, tone: queued ? 'text-amber-600' : '' },
      { label: 'Offline', value: offline, tone: offline ? 'text-red-600' : 'text-zinc-400' },
    ];
  });
}
