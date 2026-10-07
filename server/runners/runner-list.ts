// The org runner lists. GitHub has no webhook for runners going online,
// offline or busy, so these are polled (ETag: unchanged lists are free).

import type { Runner } from '../../shared/snapshot.ts';
import type { GhRunner } from '../github/types.ts';
import { toRunner } from '../mapping.ts';
import type { Org } from '../org.ts';
import type { HostResolver } from './host-resolver.ts';

export class RunnerList {
  runners: Runner[] = [];
  private readonly orgs: Org[];
  private readonly hosts: HostResolver;

  constructor(orgs: Org[], hosts: HostResolver) {
    this.orgs = orgs;
    this.hosts = hosts;
  }

  /** Returns true if any runner changed. */
  async refresh(): Promise<boolean> {
    const perOrg = await Promise.all(this.orgs.map((org) => this.fetch(org)));
    const runners = perOrg.flat();
    const changed = JSON.stringify(runners) !== JSON.stringify(this.runners);
    this.runners = runners;
    return changed;
  }

  private async fetch(org: Org): Promise<Runner[]> {
    try {
      const res = await org.gh.get<{ runners: GhRunner[] }>(
        `/orgs/${org.name}/actions/runners?per_page=100`,
      );
      org.errors.runners = null;
      return res.runners.map((r) => toRunner(r, org.name, this.hosts));
    } catch (err) {
      console.error(`[${org.name}] runners`, err);
      org.errors.runners = String(err);
      // keep the last known runners of this org
      return this.runners.filter((r) => r.org === org.name);
    }
  }
}
