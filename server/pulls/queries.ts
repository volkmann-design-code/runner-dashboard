// GraphQL queries for open pull requests, about 3 points per 100 PRs.
// GitHub gives up on a query after ~10 s (502), and the org search is slow
// (50 PRs: 4-9 s), hence the small pages.

const PULL_REQUEST = `
  fragment PullRequestFields on PullRequest {
    number
    title
    url
    isDraft
    createdAt
    mergeable
    reviewDecision
    headRefName
    baseRefName
    isCrossRepository
    headRepositoryOwner { login }
    author { login __typename }
    repository { name defaultBranchRef { name } }
    commits(last: 1) { nodes { commit { committedDate statusCheckRollup { state } } } }
    comments(last: 1) { nodes { createdAt } }
    reviews(last: 1) { nodes { submittedAt } }
  }
`;

/** All open PRs of an org, 25 per page (up to ~6 s each). Search can lag a few seconds behind GitHub. */
export const SEARCH_PULLS = `
  query($q: String!, $after: String) {
    search(query: $q, type: ISSUE, first: 25, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { ...PullRequestFields }
    }
  }
  ${PULL_REQUEST}
`;

/** The open PRs of one repo, read directly (no search lag), for webhook-triggered refreshes; ~2 s for 40 PRs. */
export const REPO_PULLS = `
  query($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(states: OPEN, first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { ...PullRequestFields }
      }
    }
  }
  ${PULL_REQUEST}
`;
