// The fields we read from GitHub's REST responses (docs.github.com/rest/actions),
// GraphQL queries (server/pulls/queries.ts) and webhooks.

export interface GhRunner {
  id: number;
  name: string;
  status: 'online' | 'offline';
  busy: boolean;
  labels: { name: string }[];
}

export interface GhRepo {
  name: string;
  archived: boolean;
  pushed_at: string | null;
}

export interface GhRun {
  id: number;
  name: string | null;
  run_attempt: number;
  status: string;
  updated_at: string;
  head_branch: string | null;
  pull_requests: { number: number }[];
}

export interface GhJob {
  id: number;
  run_id: number;
  workflow_name: string | null;
  name: string;
  head_branch: string | null;
  status: string;
  conclusion: string | null;
  runner_name: string | null;
  labels: string[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
}

/** What every webhook we handle carries (pull_request, pull_request_review, workflow_job). */
export interface GhRepoEvent {
  repository: { name: string };
  organization?: { login: string };
}

/** Body of the `workflow_job` webhook (docs.github.com/webhooks/webhook-events-and-payloads#workflow_job). */
export interface GhWorkflowJobEvent extends GhRepoEvent {
  action: 'queued' | 'waiting' | 'in_progress' | 'completed';
  workflow_job: GhJob;
}

/** A pull request as the PULL_REQUEST fragment in server/pulls/queries.ts reads it. */
export interface GqlPullRequest {
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  createdAt: string;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  headRefName: string;
  baseRefName: string;
  isCrossRepository: boolean;
  headRepositoryOwner: { login: string } | null;
  author: { login: string; __typename: string } | null;
  repository: { name: string; defaultBranchRef: { name: string } | null };
  commits: { nodes: { commit: { committedDate: string; statusCheckRollup: { state: string } | null } }[] };
  comments: { nodes: { createdAt: string }[] };
  reviews: { nodes: { submittedAt: string | null }[] };
}
