// Small builders for test data.

import type { Job } from '../../shared/snapshot.ts';
import type { GhJob, GqlPullRequest } from '../github/types.ts';

export function ghJob(overrides: Partial<GhJob> = {}): GhJob {
  return {
    id: 1,
    run_id: 10,
    workflow_name: 'CI',
    name: 'build',
    head_branch: 'main',
    status: 'queued',
    conclusion: null,
    runner_name: null,
    labels: ['self-hosted', 'linux'],
    created_at: '2026-01-01T10:00:00Z',
    started_at: null,
    completed_at: null,
    html_url: 'https://github.com/my-org/app/actions/runs/10/job/1',
    ...overrides,
  };
}

export function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    runId: 10,
    org: 'my-org',
    repo: 'app',
    workflow: 'CI',
    name: 'build',
    branch: 'main',
    pr: null,
    status: 'queued',
    conclusion: null,
    githubHosted: false,
    runnerName: null,
    runnerHost: null,
    runnerShortName: null,
    labels: ['self-hosted'],
    createdAt: '2026-01-01T10:00:00Z',
    startedAt: null,
    completedAt: null,
    url: 'https://github.com/my-org/app/actions/runs/10/job/1',
    ...overrides,
  };
}

export function gqlPull(overrides: Partial<GqlPullRequest> = {}): GqlPullRequest {
  return {
    number: 1,
    title: 'Add things',
    url: 'https://github.com/my-org/app/pull/1',
    isDraft: false,
    createdAt: '2026-01-01T10:00:00Z',
    mergeable: 'MERGEABLE',
    reviewDecision: null,
    headRefName: 'feat/things',
    baseRefName: 'main',
    isCrossRepository: false,
    headRepositoryOwner: { login: 'my-org' },
    author: { login: 'alice', __typename: 'User' },
    repository: { name: 'app', defaultBranchRef: { name: 'main' } },
    commits: { nodes: [{ commit: { committedDate: '2026-01-02T10:00:00Z', statusCheckRollup: { state: 'SUCCESS' } } }] },
    comments: { nodes: [] },
    reviews: { nodes: [] },
    ...overrides,
  };
}
