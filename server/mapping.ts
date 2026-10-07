// GitHub API shapes → snapshot shapes.

import type { Job, PullRequest, Runner } from '../shared/snapshot.ts';
import type { GhJob, GhRunner, GqlPullRequest } from './github/types.ts';
import type { HostResolver } from './runners/host-resolver.ts';

/** What a job needs from its workflow run (the job payload lacks the PR). */
export interface RunDetails {
  name: string | null;
  headBranch: string | null;
  pr: number | null;
}

/** Host shown for jobs on GitHub's runners ("GitHub Actions 12" has no host part). */
export const GITHUB_HOST = 'github';

export function toRunner(r: GhRunner, org: string, hosts: HostResolver): Runner {
  const labels = r.labels.map((l) => l.name);
  return {
    id: r.id,
    org,
    name: r.name,
    shortName: hosts.shortName(r.name),
    // without host information, each org is one group
    host: hosts.ofRunner(r.name, labels) ?? org,
    status: r.status,
    busy: r.busy,
    labels: labels.filter((l) => !hosts.isHostLabel(l)),
    jobId: null,
  };
}

/** For self-hosted jobs, runnerHost and runnerShortName are filled in per snapshot (build-snapshot.ts). */
export function toJob(j: GhJob, org: string, repo: string, run: RunDetails | null): Job {
  const githubHosted = !isSelfHosted(j);
  return {
    id: j.id,
    runId: j.run_id,
    org,
    repo,
    workflow: j.workflow_name ?? run?.name ?? '',
    name: j.name,
    branch: j.head_branch ?? run?.headBranch ?? null,
    pr: run?.pr ?? null,
    status: j.status,
    conclusion: j.conclusion,
    githubHosted,
    runnerName: j.runner_name,
    runnerHost: githubHosted ? GITHUB_HOST : null,
    runnerShortName: githubHosted ? j.runner_name : null,
    labels: j.labels,
    createdAt: j.created_at,
    startedAt: j.started_at,
    completedAt: j.completed_at,
    url: j.html_url,
  };
}

export function toPullRequest(p: GqlPullRequest, org: string): PullRequest {
  return {
    org,
    repo: p.repository.name,
    number: p.number,
    title: p.title,
    head: p.isCrossRepository ? `${p.headRepositoryOwner?.login ?? '?'}:${p.headRefName}` : p.headRefName,
    base: p.baseRefName,
    defaultBranch: p.repository.defaultBranchRef?.name ?? 'main',
    draft: p.isDraft,
    author: p.author?.login ?? null,
    authorIsBot: p.author?.__typename === 'Bot',
    mergeable: p.mergeable,
    review: p.reviewDecision,
    checks: p.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
    activeAt: latest([
      p.createdAt,
      p.commits.nodes[0]?.commit.committedDate,
      p.comments.nodes[0]?.createdAt,
      p.reviews.nodes[0]?.submittedAt,
    ]),
    url: p.url,
  };
}

/** The latest of some ISO timestamps (all UTC, so they compare as strings). */
function latest(dates: (string | null | undefined)[]): string {
  return dates.reduce<string>((max, d) => (d && d > max ? d : max), '');
}

/** Targets self-hosted runners: their `runs-on` always includes self-hosted. */
function isSelfHosted(job: GhJob): boolean {
  return job.labels.some((l) => l.toLowerCase() === 'self-hosted');
}
