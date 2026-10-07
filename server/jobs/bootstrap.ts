// Fills the job store once at startup: webhooks only report changes, so
// jobs that were already queued or running when the server started are
// fetched from the REST API: about two requests per repo.

import type { GhJob, GhRepo, GhRun } from '../github/types.ts';
import { toJob } from '../mapping.ts';
import type { Org } from '../org.ts';
import type { JobStore } from './job-store.ts';
import { mapLimit } from './map-limit.ts';
import type { RunDetailsCache } from './run-details.ts';

const HISTORY_WINDOW_MS = 12 * 60 * 60_000;
const HISTORY_RUNS = 20;
const CONCURRENCY = 8;

interface RepoRun extends GhRun {
  repo: string;
}

export async function bootstrap(
  org: Org,
  store: JobStore,
  runs: RunDetailsCache,
): Promise<void> {
  const repos = await listRepos(org);
  const perRepo = await mapLimit(repos, CONCURRENCY, async (repo) => {
    const res = await org.gh.get<{ workflow_runs: GhRun[] }>(
      `/repos/${org.name}/${repo}/actions/runs?per_page=20`,
    );
    return res.workflow_runs.map((run): RepoRun => ({ ...run, repo }));
  });

  const now = Date.now();
  const all = perRepo.flat();
  const active = all.filter((r) => r.status !== 'completed');
  const finished = all
    .filter((r) => r.status === 'completed' && now - Date.parse(r.updated_at) < HISTORY_WINDOW_MS)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, HISTORY_RUNS);

  await mapLimit([...active, ...finished], CONCURRENCY, async (run) => {
    const details = runs.remember(run);
    const res = await org.gh.get<{ jobs: GhJob[] }>(
      `/repos/${org.name}/${run.repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
    );
    for (const job of res.jobs) {
      store.upsert(toJob(job, org.name, run.repo, details));
    }
  });
  console.log(`[${org.name}] bootstrap: ${repos.length} repos, ${active.length} active runs`);
}

async function listRepos(org: Org): Promise<string[]> {
  const repos: string[] = [];
  for (let page = 1; ; page++) {
    const batch = await org.gh.get<GhRepo[]>(
      `/orgs/${org.name}/repos?per_page=100&sort=pushed&page=${page}`,
    );
    repos.push(...batch.filter((r) => !r.archived).map((r) => r.name));
    if (batch.length < 100) return repos;
  }
}
