import { Component, inject, input } from '@angular/core';
import { Preferences } from '../core/preferences';
import type { RepoView } from './pull-view';

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** A repo's sidebar settings, stored in this browser: inactivity fold, excluded authors, hide. */
@Component({
  selector: 'app-repo-settings',
  host: { class: 'flex flex-col gap-3 bg-zinc-50 px-4 py-3 text-xs dark:bg-zinc-950/50' },
  template: `
    <label class="flex items-center gap-2">
      <span class="text-zinc-500">Fold PRs inactive for</span>
      <select class="ml-auto cursor-pointer rounded-md bg-white px-1.5 py-0.5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700"
        (change)="setWeeks($any($event.target).value)">
        @for (w of weeks; track w) {
          <option [value]="w" [selected]="repo().hideOlderThanWeeks === w">{{ w }} {{ w === 1 ? 'week' : 'weeks' }}</option>
        }
        <option value="never" [selected]="repo().hideOlderThanWeeks === null">never</option>
      </select>
    </label>

    <fieldset>
      <legend class="mb-1 text-zinc-500">Exclude authors</legend>
      <ul class="flex flex-col gap-0.5">
        @for (a of repo().authors; track a.login) {
          <li>
            <label class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <input type="checkbox" class="accent-zinc-700" [checked]="a.excluded"
                (change)="preferences.setAuthorExcluded(repo().key, a.login, $any($event.target).checked, a.excludedByDefault)" />
              <span class="truncate" [class.text-zinc-400]="a.excluded">{{ a.login }}</span>
              @if (a.bot) {
                <span class="shrink-0 rounded bg-zinc-200 px-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">bot</span>
              }
              <span class="ml-auto shrink-0 tabular-nums text-zinc-400">{{ a.count }}</span>
            </label>
          </li>
        }
      </ul>
    </fieldset>

    <div class="flex items-center gap-3 text-zinc-500">
      <button type="button" class="cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" (click)="preferences.setRepoHidden(repo().key, true)">Hide repo</button>
      @if (repo().customized) {
        <button type="button" class="ml-auto cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" (click)="preferences.resetRepo(repo().key)">Reset to defaults</button>
      }
    </div>
  `,
})
export class RepoSettings {
  readonly repo = input.required<RepoView>();

  protected readonly preferences = inject(Preferences);
  protected readonly weeks = WEEKS;

  protected setWeeks(value: string): void {
    this.preferences.setHideOlderThanWeeks(this.repo().key, value === 'never' ? null : Number(value));
  }
}
