import { Injectable, signal } from '@angular/core';

/** Default for RepoSettings.hideOlderThanWeeks. */
export const DEFAULT_HIDE_OLDER_THAN_WEEKS = 4;

/**
 * Sidebar settings of one repo. Only what differs from the defaults is
 * stored, so a repo without settings follows them (also when they change).
 */
export interface RepoSettings {
  /** Fold stacks without activity for this many weeks; null: never. Missing: DEFAULT_HIDE_OLDER_THAN_WEEKS. */
  hideOlderThanWeeks?: number | null;
  /**
   * Authors whose exclusion differs from the default (bots excluded, people
   * shown): true excludes, false shows. A new bot is excluded until shown.
   */
  excludeAuthors?: Record<string, boolean>;
}

/** View settings, remembered per browser (localStorage may be unavailable). */
@Injectable({ providedIn: 'root' })
export class Preferences {
  /** Runner IDs (the random name suffix) are rarely needed, hidden unless toggled. */
  readonly showRunnerIds = signal(read('showRunnerIds') === 'true');
  /** Repos ("org/repo") left out of the pull request sidebar. */
  readonly hiddenRepos = signal<ReadonlySet<string>>(new Set(readJson<string[]>('hiddenRepos', [], Array.isArray)));
  /** Per repo ("org/repo"). */
  readonly repoSettings = signal<Readonly<Record<string, RepoSettings>>>(
    readJson('repoSettings', {}, (v) => typeof v === 'object' && v !== null && !Array.isArray(v)),
  );

  toggleRunnerIds(): void {
    this.showRunnerIds.update((v) => !v);
    write('showRunnerIds', String(this.showRunnerIds()));
  }

  setRepoHidden(repo: string, hidden: boolean): void {
    this.hiddenRepos.update((set) => {
      const next = new Set(set);
      if (hidden) next.add(repo);
      else next.delete(repo);
      return next;
    });
    write('hiddenRepos', JSON.stringify([...this.hiddenRepos()]));
  }

  setHideOlderThanWeeks(repo: string, weeks: number | null): void {
    this.updateRepo(repo, (s) => {
      if (weeks === DEFAULT_HIDE_OLDER_THAN_WEEKS) delete s.hideOlderThanWeeks;
      else s.hideOlderThanWeeks = weeks;
    });
  }

  /** `byDefault`: whether the author is excluded without a setting (bots). */
  setAuthorExcluded(repo: string, author: string, excluded: boolean, byDefault: boolean): void {
    this.updateRepo(repo, (s) => {
      const authors = { ...s.excludeAuthors };
      if (excluded === byDefault) delete authors[author];
      else authors[author] = excluded;
      if (Object.keys(authors).length) s.excludeAuthors = authors;
      else delete s.excludeAuthors;
    });
  }

  resetRepo(repo: string): void {
    this.updateRepo(repo, (s) => {
      delete s.hideOlderThanWeeks;
      delete s.excludeAuthors;
    });
  }

  private updateRepo(repo: string, change: (settings: RepoSettings) => void): void {
    this.repoSettings.update((all) => {
      const next = { ...all };
      const settings = { ...next[repo] };
      change(settings);
      if (Object.keys(settings).length) next[repo] = settings;
      else delete next[repo];
      return next;
    });
    write('repoSettings', JSON.stringify(this.repoSettings()));
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T, valid: (value: unknown) => boolean): T {
  try {
    const value: unknown = JSON.parse(read(key) ?? 'null');
    return valid(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
