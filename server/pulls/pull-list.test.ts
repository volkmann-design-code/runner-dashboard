import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GitHubError } from '../github/client.ts';
import type { GqlPullRequest } from '../github/types.ts';
import { Org } from '../org.ts';
import { gqlPull } from '../test/fixtures.ts';
import { PullList } from './pull-list.ts';

type Answer = (query: string, variables: Record<string, unknown>) => Promise<unknown>;

/** An org whose GraphQL calls are answered by `answer`. */
function orgAnswering(answer: Answer): Org {
  const org = new Org('my-org', 'my', 'token', 'secret');
  (org.gh as unknown as { graphql: Answer }).graphql = answer;
  return org;
}

const search = (nodes: GqlPullRequest[], endCursor: string | null = null) => ({
  search: { pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes },
});
const repo = (nodes: GqlPullRequest[]) => ({
  repository: { pullRequests: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PullList', () => {
  it('reads all pages of the org search and tells listeners once', async () => {
    const org = orgAnswering(async (_q, v) =>
      v['after'] ? search([gqlPull({ number: 2 })]) : search([gqlPull({ number: 1 })], 'page-2'),
    );
    const list = new PullList();
    let changes = 0;
    list.onChange(() => changes++);
    await list.refreshOrg(org);
    assert.deepEqual(list.all().map((p) => p.number).sort(), [1, 2]);
    assert.equal(changes, 1);
    await list.refreshOrg(org);
    assert.equal(changes, 1, 'unchanged PRs are no change');
  });

  it('retries a page once when GitHub gives up (502)', async () => {
    let calls = 0;
    const org = orgAnswering(async () => {
      if (++calls === 1) throw new GitHubError(502, 'Bad Gateway');
      return search([gqlPull()]);
    });
    const list = new PullList();
    await list.refreshOrg(org);
    assert.equal(list.all().length, 1);
    assert.equal(org.errors.pulls, null);
  });

  it('reports a failed read on the org and keeps the PRs it had', async () => {
    let fail = false;
    const org = orgAnswering(async () => {
      if (fail) throw new GitHubError(401, 'Bad credentials');
      return search([gqlPull()]);
    });
    const list = new PullList();
    await list.refreshOrg(org);
    fail = true;
    await list.refreshOrg(org);
    assert.equal(list.all().length, 1);
    assert.match(org.errors.pulls ?? '', /Bad credentials/);
  });

  it('does not let a slow org read overwrite a repo re-read meanwhile', async () => {
    let releaseSearch!: () => void;
    const searchDone = new Promise<void>((resolve) => (releaseSearch = resolve));
    const org = orgAnswering(async (query) => {
      if (query.includes('search(')) {
        await searchDone;
        return search([gqlPull({ number: 1, title: 'old title' })]);
      }
      return repo([gqlPull({ number: 1, title: 'new title' })]);
    });
    const list = new PullList();
    const orgRead = list.refreshOrg(org);
    list.refreshRepoSoon(org, 'app');
    await new Promise((resolve) => setTimeout(resolve, 2_100)); // debounce
    await tick();
    releaseSearch();
    await orgRead;
    assert.deepEqual(list.all().map((p) => p.title), ['new title']);
  });

  it('runs one org read at a time', async () => {
    let searches = 0;
    const org = orgAnswering(async () => {
      searches++;
      await tick();
      return search([]);
    });
    const list = new PullList();
    await Promise.all([list.refreshOrg(org), list.refreshOrg(org)]);
    assert.equal(searches, 1);
  });
});
