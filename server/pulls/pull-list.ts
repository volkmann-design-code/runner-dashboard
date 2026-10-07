// Open pull requests of all orgs, for the stack sidebar. Read once per org
// at startup (GraphQL search), then kept live by webhooks: a pull_request,
// pull_request_review, status or check_suite delivery, or a finished job of
// a PR (its checks changed), re-reads that repo's open PRs. While a tab is
// open, each org is also re-read every few minutes, for missed deliveries.

import type { PullRequest } from '../../shared/snapshot.ts';
import { GitHubError } from '../github/client.ts';
import type { GqlPullRequest } from '../github/types.ts';
import { toPullRequest } from '../mapping.ts';
import type { Org } from '../org.ts';
import { REPO_PULLS, SEARCH_PULLS } from './queries.ts';

/** A review often comes with a push, a matrix build with many finished jobs: one read per burst. */
const REPO_DEBOUNCE_MS = 2_000;
const FALLBACK_MS = 5 * 60_000;
/** Without a webhook secret nothing pushes changes, so poll more often. */
const FALLBACK_NO_WEBHOOK_MS = 60_000;

export class PullList {
  /** "org/repo#number" → PR */
  private readonly pulls = new Map<string, PullRequest>();
  private readonly orgReadAt = new Map<string, number>();
  private readonly orgsReading = new Set<string>();
  /** "org/repo" → when its last repo read finished; an org read started before must not overwrite it. */
  private readonly repoReadAt = new Map<string, number>();
  private readonly repoTimers = new Map<string, NodeJS.Timeout>();
  private readonly listeners = new Set<() => void>();

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  all(): PullRequest[] {
    return [...this.pulls.values()];
  }

  /** Reads all open PRs of the org: a few hundred take up to a minute (25 per page, see queries.ts). */
  async refreshOrg(org: Org): Promise<void> {
    if (this.orgsReading.has(org.name)) return;
    this.orgsReading.add(org.name);
    const startedAt = Date.now();
    try {
      const nodes: GqlPullRequest[] = [];
      let after: string | null = null;
      do {
        const data: SearchResult = await graphqlRetry<SearchResult>(org, SEARCH_PULLS, {
          q: `org:${org.name} is:pr is:open archived:false`,
          after,
        });
        nodes.push(...data.search.nodes);
        after = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null;
      } while (after);
      org.errors.pulls = null;
      // repos re-read by webhook while this ran keep their newer PRs
      const newer = (repo: string) => (this.repoReadAt.get(`${org.name}/${repo}`) ?? 0) > startedAt;
      this.replace(
        (p) => p.org === org.name && !newer(p.repo),
        this.map(nodes, org).filter((p) => !newer(p.repo)),
      );
    } catch (err) {
      console.error(`[${org.name}] pull requests`, err);
      org.errors.pulls = `pull requests: ${err}`;
    } finally {
      this.orgsReading.delete(org.name);
      this.orgReadAt.set(org.name, Date.now());
    }
  }

  /** Re-read one repo's open PRs after a short delay; calls within it collapse into one read. */
  refreshRepoSoon(org: Org, repo: string): void {
    const key = `${org.name}/${repo}`;
    if (this.repoTimers.has(key)) return;
    this.repoTimers.set(
      key,
      setTimeout(() => {
        this.repoTimers.delete(key);
        void this.refreshRepo(org, repo);
      }, REPO_DEBOUNCE_MS),
    );
  }

  /** Called every minute while a tab is open: re-reads orgs not read for their fallback interval. */
  refreshStale(orgs: Org[]): void {
    const now = Date.now();
    for (const org of orgs) {
      const interval = org.webhookSecret ? FALLBACK_MS : FALLBACK_NO_WEBHOOK_MS;
      if (now - (this.orgReadAt.get(org.name) ?? 0) >= interval) void this.refreshOrg(org);
    }
  }

  private async refreshRepo(org: Org, repo: string): Promise<void> {
    try {
      const nodes: GqlPullRequest[] = [];
      let after: string | null = null;
      do {
        const data: RepoResult = await graphqlRetry<RepoResult>(org, REPO_PULLS, { owner: org.name, name: repo, after });
        const page = data.repository?.pullRequests;
        nodes.push(...(page?.nodes ?? []));
        after = page?.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
      } while (after);
      this.replace((p) => p.org === org.name && p.repo === repo, this.map(nodes, org));
      this.repoReadAt.set(`${org.name}/${repo}`, Date.now());
    } catch (err) {
      console.error(`[${org.name}] pull requests of ${repo}`, err);
    }
  }

  private map(nodes: GqlPullRequest[], org: Org): PullRequest[] {
    // a search hit can be an empty object when the token cannot see the PR
    return nodes.filter((n) => n?.number).map((n) => toPullRequest(n, org.name));
  }

  /** Swap the PRs matching `scope` for `next`; tells listeners only if something changed. */
  private replace(scope: (p: PullRequest) => boolean, next: PullRequest[]): void {
    const before = fingerprint(this.all().filter(scope));
    for (const [key, p] of this.pulls) if (scope(p)) this.pulls.delete(key);
    for (const p of next) this.pulls.set(`${p.org}/${p.repo}#${p.number}`, p);
    if (fingerprint(next) === before) return;
    for (const listener of this.listeners) listener();
  }
}

/** Order-independent: search and repo reads list the same PRs in different orders. */
function fingerprint(pulls: PullRequest[]): string {
  return pulls.map((p) => JSON.stringify(p)).sort().join('\n');
}

/** GitHub answers a slow GraphQL query with 502/504 after ~10 s; one more try usually works. */
async function graphqlRetry<T>(org: Org, query: string, variables: Record<string, unknown>): Promise<T> {
  try {
    return await org.gh.graphql<T>(query, variables);
  } catch (err) {
    if (!(err instanceof GitHubError) || (err.status !== 502 && err.status !== 504)) throw err;
    return org.gh.graphql<T>(query, variables);
  }
}

interface SearchResult {
  search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GqlPullRequest[] };
}

interface RepoResult {
  repository: {
    pullRequests: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GqlPullRequest[] };
  } | null;
}
