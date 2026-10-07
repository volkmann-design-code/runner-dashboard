// The contract between server and browser: what /api/events streams.

export interface Runner {
  id: number;
  org: string;
  name: string;
  /** The "id" part of the name (RUNNER_NAME_PATTERN), else the full name. */
  shortName: string;
  /** Host the runner lives on (server/runners/host-resolver.ts), else its org. */
  host: string;
  status: 'online' | 'offline';
  busy: boolean;
  /** Without the host label. */
  labels: string[];
  /** The in-progress job whose runner_name matches, if we found it. */
  jobId: number | null;
}

export interface Job {
  id: number;
  runId: number;
  org: string;
  repo: string;
  workflow: string;
  name: string;
  branch: string | null;
  /** PR number when the run belongs to a pull request of the same repo (not forks). */
  pr: number | null;
  status: string; // queued | in_progress | completed | waiting | pending | requested
  conclusion: string | null;
  /** Ran (or waits) on GitHub's own runners instead of ours: runs-on lacks self-hosted. */
  githubHosted: boolean;
  runnerName: string | null;
  /** Host of the self-hosted runner (server/runners/host-resolver.ts), or "github" for GitHub-hosted jobs. */
  runnerHost: string | null;
  runnerShortName: string | null;
  labels: string[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  url: string;
}

/**
 * An open pull request, streamed as its own SSE event ("pulls", all open PRs
 * at once) whenever they change. Stacks are derived in the browser: a PR
 * whose base is another PR's head sits on top of it.
 */
export interface PullRequest {
  org: string;
  repo: string;
  number: number;
  title: string;
  /** Head branch; "owner:branch" for PRs from forks, so they never match another PR's base. */
  head: string;
  base: string;
  defaultBranch: string;
  draft: boolean;
  author: string | null;
  /** GitHub App accounts (Renovate, Dependabot, Copilot, …); the browser excludes them by default. */
  authorIsBot: boolean;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  review: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  /** Combined checks of the head commit: SUCCESS, FAILURE, ERROR, PENDING, EXPECTED; null without checks. */
  checks: string | null;
  /**
   * Last commit, comment or review (or creation). Not GitHub's updatedAt: bulk changes to a
   * repo bump that on every open PR without anything showing in their timelines.
   */
  activeAt: string;
  url: string;
}

export interface OrgStatus {
  org: string;
  /** Badge text (ORG_LABELS), defaults to the org name. */
  label: string;
  /** Last accepted webhook delivery; stays null if the org webhook is missing or broken. */
  lastWebhookAt: string | null;
  rateLimitRemaining: number | null;
  rateLimitReset: string | null;
  error: string | null;
}

export interface Snapshot {
  generatedAt: string;
  /** DASHBOARD_TITLE */
  title: string;
  runners: Runner[];
  /** queued and in_progress jobs, self-hosted and GitHub-hosted */
  activeJobs: Job[];
  /** finished jobs, newest first */
  recentJobs: Job[];
  orgs: OrgStatus[];
}
