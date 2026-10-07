import { Component, inject, input } from '@angular/core';
import { Clock } from './core/clock';
import { DurationPipe } from './core/duration-pipe';
import { LiveSnapshot } from './core/live-snapshot';
import { Preferences } from './core/preferences';

/** Title, connection state, last update and view toggles. */
@Component({
  selector: 'app-page-header',
  host: { class: 'flex flex-wrap items-center gap-x-4 gap-y-1' },
  imports: [DurationPipe],
  template: `
    <h1 class="text-xl font-semibold">{{ title() }}</h1>
    <span class="flex items-center gap-1.5 text-sm" [class]="live.connected() ? 'text-emerald-600' : 'text-amber-600'">
      <span class="size-2 rounded-full" [class]="live.connected() ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'"></span>
      {{ live.connected() ? 'live' : 'reconnecting…' }}
    </span>
    @if (updatedAt(); as at) {
      <span class="text-sm text-zinc-500">updated {{ at | duration: clock.now() }} ago</span>
    }
    <label class="ml-auto flex cursor-pointer items-center gap-2 text-sm text-zinc-500 select-none">
      <input type="checkbox" class="accent-zinc-700" [checked]="preferences.showRunnerIds()" (change)="preferences.toggleRunnerIds()" />
      Runner IDs
    </label>
  `,
})
export class PageHeader {
  /** DASHBOARD_TITLE */
  readonly title = input('Runners');
  readonly updatedAt = input<string>();

  protected readonly live = inject(LiveSnapshot);
  protected readonly clock = inject(Clock);
  protected readonly preferences = inject(Preferences);
}
