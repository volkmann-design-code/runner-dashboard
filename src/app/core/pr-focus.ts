import { computed, Directive, inject, Injectable, input, signal } from '@angular/core';
import type { Job, PullRequest } from '../../../shared/snapshot';

/** "org/repo#number", the key PRs and jobs share. */
export function prKey(org: string, repo: string, pr: number): string {
  return `${org}/${repo}#${pr}`;
}

export function prKeyOfJob(job: Job | undefined): string | null {
  return job?.pr == null ? null : prKey(job.org, job.repo, job.pr);
}

export function prKeyOfPull(pr: PullRequest): string {
  return prKey(pr.org, pr.repo, pr.number);
}

/** The PR under the mouse, as a PR row in the sidebar or as one of its jobs; both sides highlight it. */
@Injectable({ providedIn: 'root' })
export class PrFocus {
  readonly key = signal<string | null>(null);
}

/**
 * Put on a whole row (job or PR): hovering it focuses the PR, and the row
 * turns violet while its PR is focused. On the row rather than its text, so
 * moving across the row does not flicker.
 */
@Directive({
  selector: '[appPrHighlight]',
  host: {
    '[class]': 'focused() ? "transition-colors bg-violet-50 dark:bg-violet-950" : "transition-colors"',
    '(mouseenter)': 'key() && focus.key.set(key())',
    '(mouseleave)': 'key() && focus.key.set(null)',
  },
})
export class PrHighlight {
  /** Key of the row's PR (prKey); null for jobs without a PR. */
  readonly key = input<string | null>(null, { alias: 'appPrHighlight' });

  protected readonly focus = inject(PrFocus);
  protected readonly focused = computed(() => this.key() !== null && this.focus.key() === this.key());
}
