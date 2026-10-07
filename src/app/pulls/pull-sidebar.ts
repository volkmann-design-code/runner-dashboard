import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import type { Job, PullRequest } from '../../../shared/snapshot';
import { OrgBadges } from '../core/org-badge';
import { prKeyOfJob, prKeyOfPull, PrHighlight } from '../core/pr-focus';
import { Preferences } from '../core/preferences';
import { type LiveState, PullRow } from './pull-row';
import { PullView, type RepoView } from './pull-view';
import { RepoSettings } from './repo-settings';
import type { Stack } from './stacks';

const CARD = 'block rounded-xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800';

/**
 * Open pull requests, one card per repo, as stacks (the heading is part of
 * the page grid, see app.ts). Each repo has settings stored in this browser
 * (repo-settings.ts): stacks without activity for some weeks fold into a
 * collapsed section at its end, PRs of excluded authors (bots by default)
 * are left out. A last card lists repos with only inactive or only excluded
 * PRs, and hidden repos.
 */
@Component({
  selector: 'app-pull-sidebar',
  host: { class: 'flex flex-col gap-4' },
  imports: [NgTemplateOutlet, PrHighlight, PullRow, RepoSettings],
  template: `
    @if (view.activeRepos().length === 0) {
      <p class="${CARD} px-4 py-6 text-center text-sm text-zinc-400">No recent pull request</p>
    }

    @for (repo of view.activeRepos(); track repo.key) {
      <section class="${CARD}">
        <header class="border-b border-zinc-100 dark:border-zinc-800">
          <ng-container [ngTemplateOutlet]="title" [ngTemplateOutletContext]="{ $implicit: repo, large: true }" />
          @if (settingsOpen() === repo.key) {
            <app-repo-settings class="border-t border-zinc-100 dark:border-zinc-800" [repo]="repo" />
          }
        </header>
        <div class="py-1">
          <ng-container [ngTemplateOutlet]="stacks" [ngTemplateOutletContext]="{ $implicit: repo.active }" />
        </div>
        @if (repo.inactive.length) {
          <div class="border-t border-zinc-100 dark:border-zinc-800">
            <button type="button" class="flex w-full cursor-pointer items-center gap-1.5 px-4 py-2 text-left text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              (click)="toggle(expanded, repo.key)">
              <span class="w-3">{{ expanded().has(repo.key) ? '▾' : '▸' }}</span>
              {{ countOf(repo.inactive) }} inactive for {{ repo.hideOlderThanWeeks }}+ {{ repo.hideOlderThanWeeks === 1 ? 'week' : 'weeks' }}
            </button>
            @if (expanded().has(repo.key)) {
              <div class="pb-1">
                <ng-container [ngTemplateOutlet]="stacks" [ngTemplateOutletContext]="{ $implicit: repo.inactive }" />
              </div>
            }
          </div>
        }
      </section>
    }

    @if (view.inactiveRepos().length || view.excludedRepos().length || view.hiddenRepos().length) {
      <section class="${CARD} divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        @if (view.inactiveRepos().length) {
          <div>
            <ng-container [ngTemplateOutlet]="group"
              [ngTemplateOutletContext]="{ $implicit: showInactive, label: plural(view.inactiveRepos().length, 'inactive repo'), detail: plural(countOfRepos(view.inactiveRepos()), 'PR'), tooltip: 'Repos whose PRs all had no activity for a while' }" />
            @if (showInactive()) {
              @for (repo of view.inactiveRepos(); track repo.key) {
                <ng-container [ngTemplateOutlet]="title" [ngTemplateOutletContext]="{ $implicit: repo, large: false }" />
                @if (settingsOpen() === repo.key) {
                  <app-repo-settings [repo]="repo" />
                }
                <ng-container [ngTemplateOutlet]="stacks" [ngTemplateOutletContext]="{ $implicit: repo.inactive }" />
              }
              <div class="h-1.5"></div>
            }
          </div>
        }
        @if (view.excludedRepos().length) {
          <div>
            <ng-container [ngTemplateOutlet]="group"
              [ngTemplateOutletContext]="{ $implicit: showExcluded, label: plural(view.excludedRepos().length, 'repo') + ' with only excluded authors', detail: plural(totalOfRepos(view.excludedRepos()), 'PR'), tooltip: 'e.g. only Renovate or Dependabot; open a repo\\'s settings to show them' }" />
            @if (showExcluded()) {
              @for (repo of view.excludedRepos(); track repo.key) {
                <ng-container [ngTemplateOutlet]="title" [ngTemplateOutletContext]="{ $implicit: repo, large: false }" />
                @if (settingsOpen() === repo.key) {
                  <app-repo-settings [repo]="repo" />
                }
              }
              <div class="h-1.5"></div>
            }
          </div>
        }
        @if (view.hiddenRepos().length) {
          <div>
            <ng-container [ngTemplateOutlet]="group"
              [ngTemplateOutletContext]="{ $implicit: showHidden, label: plural(view.hiddenRepos().length, 'hidden repo'), detail: plural(totalOfRepos(view.hiddenRepos()), 'PR'), tooltip: 'Hidden in this browser' }" />
            @if (showHidden()) {
              <ul class="flex flex-col gap-1 px-4 pb-2.5 text-xs text-zinc-500">
                @for (repo of view.hiddenRepos(); track repo.key) {
                  <li class="flex items-center gap-2">
                    @if (badges.of(repo.org); as b) {
                      <span class="max-w-24 min-w-9 shrink-0 truncate rounded px-1 text-center font-medium" [class]="b.tone" [title]="repo.org">{{ b.label }}</span>
                    }
                    <span class="truncate">{{ repo.repo }}</span>
                    <span class="tabular-nums text-zinc-400">{{ repo.total }}</span>
                    <button type="button" class="ml-auto cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" (click)="preferences.setRepoHidden(repo.key, false)">show</button>
                  </li>
                }
              </ul>
            }
          </div>
        }
      </section>
    }

    <!-- repo name line: badge, link, counts, settings toggle -->
    <ng-template #title let-repo let-large="large">
      <div class="flex items-center gap-2" [class]="large ? 'px-4 py-2.5' : 'px-4 pt-2 pb-0.5 text-xs'">
        @if (badges.of(repo.org); as b) {
          <span class="max-w-24 min-w-9 shrink-0 truncate rounded px-1 text-center text-xs font-medium" [class]="b.tone" [title]="repo.org">{{ b.label }}</span>
        }
        <!-- name and counts share a baseline (different text sizes) -->
        <span class="flex min-w-0 items-baseline gap-2">
          <a [href]="'https://github.com/' + repo.key + '/pulls'" target="_blank" rel="noopener" class="truncate font-medium hover:underline">{{ repo.repo }}</a>
          @if (large) {
            <span class="text-sm tabular-nums text-zinc-400">{{ repo.count }}</span>
          }
          @if (repo.total > repo.count) {
            <span class="shrink-0 text-xs tabular-nums whitespace-nowrap text-zinc-400" title="PRs of excluded authors (settings)">{{ repo.count ? '+' : '' }}{{ repo.total - repo.count }} excluded</span>
          }
        </span>
        <button type="button" class="ml-auto flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          [class]="settingsOpen() === repo.key ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200' : repo.customized ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-400'"
          [title]="repo.customized ? 'Settings (changed)' : 'Settings'" [attr.aria-expanded]="settingsOpen() === repo.key"
          (click)="settingsOpen.set(settingsOpen() === repo.key ? null : repo.key)">
          <svg viewBox="0 0 16 16" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <path d="M2 4.5h7M13 4.5h1M2 11.5h1M7 11.5h7" />
            <circle cx="11" cy="4.5" r="1.75" />
            <circle cx="5" cy="11.5" r="1.75" />
          </svg>
        </button>
      </div>
    </ng-template>

    <ng-template #stacks let-stacks>
      @for (stack of stacks; track stack.rows[0].pr.number) {
        @for (row of stack.rows; track row.pr.number) {
          <app-pull-row class="px-2.5" [appPrHighlight]="pullKey(row.pr)" [row]="row" [live]="liveOf(row.pr)" />
        }
      }
    </ng-template>

    <!-- a collapsible group of the last card -->
    <ng-template #group let-open let-label="label" let-detail="detail" let-tooltip="tooltip">
      <button type="button" class="flex w-full cursor-pointer items-center gap-1.5 px-4 py-2.5 text-left text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        [title]="tooltip" (click)="open.set(!open())">
        <span class="w-3 text-xs">{{ open() ? '▾' : '▸' }}</span>
        {{ label }}
        <span class="ml-auto text-xs tabular-nums text-zinc-400">{{ detail }}</span>
      </button>
    </ng-template>
  `,
})
export class PullSidebar {
  readonly activeJobs = input.required<Job[]>();

  protected readonly view = inject(PullView);
  protected readonly preferences = inject(Preferences);
  protected readonly badges = inject(OrgBadges);
  /** Repos whose inactive stacks are unfolded. */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly showInactive = signal(false);
  protected readonly showExcluded = signal(false);
  protected readonly showHidden = signal(false);
  /** The repo whose settings are open; one at a time. */
  protected readonly settingsOpen = signal<string | null>(null);

  /** Jobs of a PR on any runner right now. */
  private readonly live = computed(() => {
    const states = new Map<string, LiveState>();
    for (const j of this.activeJobs()) {
      const key = prKeyOfJob(j);
      if (key === null) continue;
      if (j.status === 'in_progress') states.set(key, 'running');
      else if (!states.has(key)) states.set(key, 'queued');
    }
    return states;
  });

  protected readonly pullKey = prKeyOfPull;

  protected liveOf(pr: PullRequest): LiveState {
    return this.live().get(prKeyOfPull(pr)) ?? null;
  }

  protected countOf(stacks: Stack[]): number {
    return stacks.reduce((n, s) => n + s.rows.length, 0);
  }

  protected countOfRepos(repos: RepoView[]): number {
    return repos.reduce((n, r) => n + r.count, 0);
  }

  protected totalOfRepos(repos: RepoView[]): number {
    return repos.reduce((n, r) => n + r.total, 0);
  }

  protected plural(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  }

  protected toggle(set: typeof this.expanded, key: string): void {
    set.update((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

}
