// Minimal GitHub REST client. Every GET is sent with If-None-Match: a 304
// answer is free (it does not count against the rate limit), so polling
// the runner list while nothing changes costs nothing. Pull requests are
// read via GraphQL (see graphql()).

const API = 'https://api.github.com';

export class GitHubError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface CacheEntry {
  etag: string;
  body: unknown;
}

export class GitHubClient {
  rateLimitRemaining: number | null = null;
  rateLimitReset: Date | null = null;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly graphqlWarnings = new Set<string>();
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async get<T>(path: string): Promise<T> {
    const cached = this.cache.get(path);
    const res = await fetch(API + path, {
      headers: { ...this.headers(), ...(cached ? { 'If-None-Match': cached.etag } : {}) },
      signal: AbortSignal.timeout(15_000),
    });

    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');
    if (remaining) this.rateLimitRemaining = Number(remaining);
    if (reset) this.rateLimitReset = new Date(Number(reset) * 1000);

    if (res.status === 304 && cached) return cached.body as T;
    if (!res.ok) {
      const text = await res.text();
      throw new GitHubError(res.status, `GET ${path}: ${res.status} ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as T;
    const etag = res.headers.get('etag');
    if (etag) this.cache.set(path, { etag, body });
    return body;
  }

  /**
   * GraphQL has its own rate limit (points per hour, not tracked here) and
   * no ETags; the queries we send cost 3 points per 100 pull requests.
   *
   * A field the token may not read (e.g. a PR's checks without "Commit
   * statuses: Read") comes back as null next to an error; the rest of the data is
   * still used, and each such error is logged once.
   */
  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new GitHubError(res.status, `POST /graphql: ${res.status} ${text.slice(0, 200)}`);
    }
    // errors come with status 200
    const body = (await res.json()) as { data?: T | null; errors?: { message: string; path?: (string | number)[] }[] };
    const errors = body.errors ?? [];
    if (!body.data) {
      throw new GitHubError(res.status, `GraphQL: ${[...new Set(errors.map((e) => e.message))].join('; ')}`);
    }
    for (const e of errors) {
      // the field name without list indexes: "statusCheckRollup", not "search.nodes.17.commits…"
      const warning = `${e.path?.filter((p) => typeof p === 'string').at(-1) ?? '?'}: ${e.message}`;
      if (this.graphqlWarnings.has(warning)) continue;
      this.graphqlWarnings.add(warning);
      console.warn(`GraphQL field left out: ${warning}`);
    }
    return body.data;
  }

  /** Drop cache entries whose path starts with prefix (finished runs we no longer show). */
  forget(prefix: string): void {
    for (const key of this.cache.keys()) if (key.startsWith(prefix)) this.cache.delete(key);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'runner-dashboard',
    };
  }
}
