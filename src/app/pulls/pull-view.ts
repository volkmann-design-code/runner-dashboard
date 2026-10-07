import { computed, inject, Injectable } from '@angular/core';
import type { PullRequest } from '../../../shared/snapshot';
import { Clock } from '../core/clock';
import { LiveSnapshot } from '../core/live-snapshot';
import { DEFAULT_HIDE_OLDER_THAN_WEEKS, Preferences, type RepoSettings } from '../core/preferences';
import { buildStacks, newest, type Stack } from './stacks';

const WEEK_MS = 7 * 24 * 60 * 60_000;

/** Someone with open PRs in a repo, for the "exclude authors" setting. */
export interface RepoAuthor {
  login: string;
  bot: boolean;
  count: number;
  excluded: boolean;
  /** Excluded without a setting (bots). */
  excludedByDefault: boolean;
}

/** One repo in the sidebar, with its settings applied. */
export interface RepoView {
  /** "org/repo" */
  key: string;
  org: string;
  repo: string;
  /** All open PRs, excluded ones too. */
  total: number;
  /** PRs not excluded by author. */
  count: number;
  authors: RepoAuthor[];
  /** null: never fold. */
  hideOlderThanWeeks: number | null;
  /** Settings differ from the defaults. */
  customized: boolean;
  /** Stacks with activity within hideOlderThanWeeks, newest first. */
  active: Stack[];
  /** The others, folded at the end of the repo. */
  inactive: Stack[];
  activeAt: string;
}

/**
 * The PR sidebar's data: open PRs per repo, with each repo's settings
 * (excluded authors, inactivity fold) applied, sorted into the groups the
 * sidebar shows. Shared with the page heading's count.
 */
@Injectable({ providedIn: 'root' })
export class PullView {
  private readonly live = inject(LiveSnapshot);
  private readonly preferences = inject(Preferences);
  private readonly clock = inject(Clock);

  /** Minute resolution is enough to move a stack between active and inactive. */
  private readonly minute = computed(() => Math.floor(this.clock.now() / 60_000) * 60_000);

  private readonly repos = computed(() => {
    const byRepo = new Map<string, PullRequest[]>();
    for (const p of this.live.pulls()) {
      const key = `${p.org}/${p.repo}`;
      byRepo.set(key, [...(byRepo.get(key) ?? []), p]);
    }
    const settings = this.preferences.repoSettings();
    return [...byRepo]
      .map(([key, prs]) => this.view(key, prs, settings[key] ?? {}))
      .sort((a, b) => b.activeAt.localeCompare(a.activeAt));
  });

  private readonly visible = computed(() => this.repos().filter((r) => !this.preferences.hiddenRepos().has(r.key)));

  /** Repos with recent activity, one card each. */
  readonly activeRepos = computed(() => this.visible().filter((r) => r.active.length > 0));
  /** Repos whose shown PRs are all inactive. */
  readonly inactiveRepos = computed(() => this.visible().filter((r) => r.count > 0 && r.active.length === 0));
  /** Repos whose PRs are all by excluded authors (e.g. only Renovate). */
  readonly excludedRepos = computed(() => this.visible().filter((r) => r.count === 0));
  readonly hiddenRepos = computed(() => this.repos().filter((r) => this.preferences.hiddenRepos().has(r.key)));
  /** PRs shown in the sidebar, folded ones included. */
  readonly count = computed(() => this.visible().reduce((n, r) => n + r.count, 0));

  private view(key: string, prs: PullRequest[], settings: RepoSettings): RepoView {
    const authors = new Map<string, RepoAuthor>();
    for (const p of prs) {
      const login = p.author ?? 'ghost';
      const known = authors.get(login);
      if (known) {
        known.count++;
        continue;
      }
      const excludedByDefault = p.authorIsBot;
      authors.set(login, {
        login,
        bot: p.authorIsBot,
        count: 1,
        excludedByDefault,
        excluded: settings.excludeAuthors?.[login] ?? excludedByDefault,
      });
    }
    const shown = prs.filter((p) => !authors.get(p.author ?? 'ghost')!.excluded);

    const weeks = settings.hideOlderThanWeeks === undefined ? DEFAULT_HIDE_OLDER_THAN_WEEKS : settings.hideOlderThanWeeks;
    const cutoff = weeks === null ? '' : new Date(this.minute() - weeks * WEEK_MS).toISOString();
    const stacks = buildStacks(shown, prs);

    return {
      key,
      org: prs[0].org,
      repo: prs[0].repo,
      total: prs.length,
      count: shown.length,
      // people first, then bots; most PRs first
      authors: [...authors.values()].sort((a, b) => Number(a.bot) - Number(b.bot) || b.count - a.count || a.login.localeCompare(b.login)),
      hideOlderThanWeeks: weeks,
      customized: Object.keys(settings).length > 0,
      active: stacks.filter((s) => s.activeAt >= cutoff),
      inactive: stacks.filter((s) => s.activeAt < cutoff),
      // order repos by what they show; by all PRs if they show none
      activeAt: newest(shown.length ? shown : prs),
    };
  }
}
