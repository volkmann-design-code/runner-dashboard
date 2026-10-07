import type { Snapshot } from '../../../shared/snapshot';

export interface Counts {
  busy: number;
  online: number;
  offline: number;
  queued: number;
  errors: number;
}

/** The numbers behind the stats bar and the tab title. */
export function countsOf(s: Snapshot): Counts {
  const online = s.runners.filter((r) => r.status === 'online').length;
  return {
    busy: s.runners.filter((r) => r.busy).length,
    online,
    offline: s.runners.length - online,
    // GitHub-hosted jobs queue briefly all the time and are not the self-hosted runners' backlog
    queued: s.activeJobs.filter((j) => !j.githubHosted && j.status !== 'in_progress').length,
    errors: s.orgs.filter((o) => o.error).length,
  };
}
