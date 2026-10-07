import { computed, inject, Injectable } from '@angular/core';
import { LiveSnapshot } from './live-snapshot';

/** Badge colors, assigned to orgs in GITHUB_ORGS order. */
const TONES = [
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-lime-50 text-lime-700 dark:bg-lime-950 dark:text-lime-300',
  'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300',
];

export interface OrgBadge {
  /** ORG_LABELS, else the org name. */
  label: string;
  tone: string;
}

/** Badges that tell orgs apart next to runners, jobs and repos; none when only one org is watched. */
@Injectable({ providedIn: 'root' })
export class OrgBadges {
  private readonly orgs = computed(() => this.live.snapshot()?.orgs ?? []);
  private readonly byOrg = computed(() => {
    const orgs = this.orgs();
    if (orgs.length < 2) return new Map<string, OrgBadge>();
    return new Map(orgs.map((o, i): [string, OrgBadge] => [o.org, { label: o.label, tone: TONES[i % TONES.length] }]));
  });

  private readonly live = inject(LiveSnapshot);

  of(org: string): OrgBadge | null {
    return this.byOrg().get(org) ?? null;
  }
}
