import { Component, computed, inject, input } from '@angular/core';
import type { Job, Runner } from '../../../shared/snapshot';
import { Preferences } from '../core/preferences';
import { JobRow } from './job-row';

/** One runner: state dot, org badge, and the job it is working on. */
@Component({
  selector: 'app-runner-row',
  host: { class: 'block' },
  imports: [JobRow],
  template: `
    <app-job-row
      [state]="state()"
      [org]="runner().org"
      [job]="job()"
      [runner]="preferences.showRunnerIds() ? runner() : null"
      [text]="state() === 'busy' ? 'busy (job not found yet)' : state()"
    />
  `,
})
export class RunnerRow {
  readonly runner = input.required<Runner>();
  readonly job = input<Job>();

  protected readonly preferences = inject(Preferences);

  protected readonly state = computed(() => {
    const r = this.runner();
    return r.status === 'offline' ? 'offline' : r.busy ? 'busy' : 'idle';
  });
}
