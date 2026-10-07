// Safety net for missed webhooks (server down, delivery failed): an active
// job without news for STALE_MS is re-read from the REST API. Usually a
// handful of requests every few minutes.

import { GitHubError } from '../github/client.ts';
import type { GhJob } from '../github/types.ts';
import { toJob } from '../mapping.ts';
import type { Org } from '../org.ts';
import type { JobStore } from './job-store.ts';
import type { RunDetailsCache } from './run-details.ts';

const STALE_MS = 5 * 60_000;

export async function reconcile(
  orgs: Org[],
  store: JobStore,
  runs: RunDetailsCache,
): Promise<void> {
  for (const job of store.staleActive(STALE_MS)) {
    const org = orgs.find((o) => o.name === job.org);
    if (!org) continue;
    try {
      const fresh = await org.gh.get<GhJob>(`/repos/${org.name}/${job.repo}/actions/jobs/${job.id}`);
      const details = await runs.get(org, job.repo, fresh.run_id);
      if (!store.upsert(toJob(fresh, org.name, job.repo, details))) store.touch(job.id);
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) store.remove(job.id);
      else console.error(`[${org.name}] reconcile job ${job.id}`, err);
    }
  }
}
