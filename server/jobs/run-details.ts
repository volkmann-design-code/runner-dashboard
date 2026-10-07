// Workflow name, branch and PR of a run. The workflow_job webhook carries
// no PR, so the run is fetched once per run and kept.

import type { GhRun } from '../github/types.ts';
import type { RunDetails } from '../mapping.ts';
import type { Org } from '../org.ts';

const MAX_RUNS = 500;

export class RunDetailsCache {
  private readonly runs = new Map<number, RunDetails>();

  remember(run: GhRun): RunDetails {
    const details: RunDetails = {
      name: run.name,
      headBranch: run.head_branch,
      pr: run.pull_requests[0]?.number ?? null,
    };
    this.runs.set(run.id, details);
    if (this.runs.size > MAX_RUNS) this.runs.delete(this.runs.keys().next().value!);
    return details;
  }

  async get(org: Org, repo: string, runId: number): Promise<RunDetails | null> {
    const known = this.runs.get(runId);
    if (known) return known;
    try {
      return this.remember(await org.gh.get<GhRun>(`/repos/${org.name}/${repo}/actions/runs/${runId}`));
    } catch (err) {
      console.error(`[${org.name}] run ${repo}#${runId}`, err);
      return null;
    }
  }
}
