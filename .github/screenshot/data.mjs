// Made-up dashboard data for the screenshot: two orgs, three hosts, jobs and
// stacked PRs. Every time is relative to NOW, the moment the browser's clock
// is frozen at, so durations read the same on every run.

export const NOW = Date.parse('2026-10-14T09:41:00Z');

/** ISO time `minutes` before NOW. */
const ago = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const DAY = 24 * 60;

const ORGS = { acme: 'acme', labs: 'acme-labs' };
const HOSTS = {
  'build-1': ['self-hosted', 'Linux', 'X64', 'heavy'],
  'build-2': ['self-hosted', 'Linux', 'X64', 'light'],
  'mac-mini': ['self-hosted', 'macOS', 'ARM64', 'xcode'],
};

let nextJob = 9_100_000;
/** A job; `host` null for GitHub-hosted, `runner` the busy runner's short ID. */
function job({ org = ORGS.acme, repo, workflow, name, branch, pr = null, status, conclusion = null, host, runner, labels, queuedFor, ranFor, finishedAgo }) {
  const id = nextJob++;
  const githubHosted = host === null;
  const startedAgo = status === 'queued' ? null : (finishedAgo ?? 0) + ranFor;
  const createdAgo = status === 'queued' ? queuedFor : startedAgo + 0.3;
  return {
    id,
    runId: id - 1_000,
    org,
    repo,
    workflow,
    name,
    branch,
    pr,
    status,
    conclusion,
    githubHosted,
    runnerName: status === 'queued' ? null : githubHosted ? 'GitHub Actions 41' : `${org}-${host}-${runner}xQ2b`,
    runnerHost: status === 'queued' ? null : githubHosted ? 'github' : host,
    runnerShortName: status === 'queued' ? null : githubHosted ? 'GitHub Actions 41' : runner,
    labels: labels ?? (githubHosted ? ['ubuntu-latest'] : ['self-hosted', host === 'mac-mini' ? 'xcode' : 'light']),
    createdAt: ago(createdAgo),
    startedAt: startedAgo === null ? null : ago(startedAgo),
    completedAt: status === 'completed' ? ago(finishedAgo) : null,
    url: `https://github.com/${org}/${repo}/actions/runs/${id - 1_000}/job/${id}`,
  };
}

const running = [
  job({ repo: 'storefront', workflow: 'CI', name: 'e2e (chromium)', branch: 'feat/checkout-e2e', pr: 412, status: 'in_progress', host: 'build-1', runner: 'k3Jd9w', ranFor: 4.2 }),
  job({ repo: 'storefront', workflow: 'CI', name: 'unit tests', branch: 'feat/checkout-e2e', pr: 412, status: 'in_progress', host: 'build-2', runner: 'Pq81zV', ranFor: 1.5 }),
  job({ repo: 'api', workflow: 'CI', name: 'build', branch: 'feat/rate-limits', pr: 233, status: 'in_progress', host: 'build-1', runner: 'Tz0aLm', ranFor: 2.1 }),
  job({ org: ORGS.labs, repo: 'billing', workflow: 'Deploy', name: 'deploy (staging)', branch: 'main', status: 'in_progress', host: 'build-1', runner: 'b7YhQe', ranFor: 6.7 }),
  job({ repo: 'mobile-app', workflow: 'iOS', name: 'build & test', branch: 'feat/offline-sync', pr: 88, status: 'in_progress', host: 'mac-mini', runner: 'Mx4c2R', ranFor: 11.3 }),
  job({ repo: 'design-system', workflow: 'CI', name: 'visual tests', branch: 'feat/dark-mode', pr: 58, status: 'in_progress', host: 'build-2', runner: 'Hs5uWn', ranFor: 0.8 }),
  job({ repo: 'storefront', workflow: 'Lint', name: 'eslint', branch: 'fix/cart-rounding', pr: 415, status: 'in_progress', host: null, ranFor: 0.6 }),
];
const queued = [
  job({ repo: 'api', workflow: 'CI', name: 'integration (postgres 17)', branch: 'feat/rate-limits', pr: 233, status: 'queued', labels: ['self-hosted', 'heavy'], queuedFor: 0.7 }),
  job({ org: ORGS.labs, repo: 'infra', workflow: 'Terraform', name: 'plan', branch: 'chore/k8s-1.34', pr: 19, status: 'queued', labels: ['self-hosted', 'light'], queuedFor: 0.2 }),
];
const recent = [
  job({ repo: 'design-system', workflow: 'CI', name: 'build', branch: 'feat/dark-mode', pr: 58, status: 'completed', conclusion: 'success', host: 'build-2', runner: 'Hs5uWn', ranFor: 1.9, finishedAgo: 1.1 }),
  job({ repo: 'storefront', workflow: 'CI', name: 'build', branch: 'feat/checkout-e2e', pr: 412, status: 'completed', conclusion: 'success', host: 'build-1', runner: 'k3Jd9w', ranFor: 2.6, finishedAgo: 4.5 }),
  job({ repo: 'api', workflow: 'CI', name: 'lint', branch: 'feat/rate-limits', pr: 233, status: 'completed', conclusion: 'success', host: null, ranFor: 0.7, finishedAgo: 2.4 }),
  job({ org: ORGS.labs, repo: 'billing', workflow: 'CI', name: 'test', branch: 'main', status: 'completed', conclusion: 'success', host: 'build-2', runner: 'Pq81zV', ranFor: 3.4, finishedAgo: 7.0 }),
  job({ org: ORGS.labs, repo: 'infra', workflow: 'Terraform', name: 'validate', branch: 'chore/k8s-1.34', pr: 19, status: 'completed', conclusion: 'failure', host: 'build-2', runner: 'Pq81zV', ranFor: 0.9, finishedAgo: 9.2 }),
  job({ repo: 'mobile-app', workflow: 'Android', name: 'assemble', branch: 'feat/offline-sync', pr: 88, status: 'completed', conclusion: 'success', host: 'build-1', runner: 'Tz0aLm', ranFor: 6.3, finishedAgo: 11.0 }),
  job({ repo: 'storefront', workflow: 'CI', name: 'e2e (webkit)', branch: 'fix/cart-rounding', pr: 415, status: 'completed', conclusion: 'cancelled', host: 'build-1', runner: 'b7YhQe', ranFor: 1.2, finishedAgo: 12.5 }),
  job({ repo: 'design-system', workflow: 'Release', name: 'publish', branch: 'main', status: 'completed', conclusion: 'success', host: 'build-2', runner: 'Hs5uWn', ranFor: 1.4, finishedAgo: 18.0 }),
  job({ repo: 'api', workflow: 'CI', name: 'build', branch: 'main', status: 'completed', conclusion: 'success', host: 'build-1', runner: 'k3Jd9w', ranFor: 2.3, finishedAgo: 24.0 }),
  job({ repo: 'storefront', workflow: 'CI', name: 'e2e (chromium)', branch: 'main', status: 'completed', conclusion: 'success', host: 'build-1', runner: 'Tz0aLm', ranFor: 6.9, finishedAgo: 31.0 }),
];

/** Runners per host: busy ones get the running jobs, the rest idle. */
function runners() {
  const list = [];
  let id = 4_200;
  const counts = { 'build-1': 8, 'build-2': 6, 'mac-mini': 2 };
  for (const [host, count] of Object.entries(counts)) {
    const busy = running.filter((j) => j.runnerHost === host);
    for (let i = 0; i < count; i++) {
      const j = busy[i];
      const org = j?.org ?? (i % 3 === 2 ? ORGS.labs : ORGS.acme);
      const shortName = j?.runnerShortName ?? `r${host.length}${i}Xa${String.fromCharCode(97 + i)}`;
      list.push({
        id: id++,
        org,
        name: j?.runnerName ?? `${org}-${host}-${shortName}xQ2b`,
        shortName,
        host,
        status: 'online',
        busy: Boolean(j),
        labels: HOSTS[host],
        jobId: j?.id ?? null,
      });
    }
  }
  return list;
}

export const snapshot = {
  generatedAt: new Date(NOW).toISOString(),
  title: 'Runners',
  runners: runners(),
  activeJobs: [...running, ...queued].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  recentJobs: recent.sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  orgs: [
    { org: ORGS.acme, label: 'acme', lastWebhookAt: ago(0.1), rateLimitRemaining: 4_874, rateLimitReset: ago(-38), error: null },
    { org: ORGS.labs, label: 'labs', lastWebhookAt: ago(0.2), rateLimitRemaining: 4_991, rateLimitReset: ago(-38), error: null },
  ],
};

/** A PR; `on` is the branch it targets (default: main). */
function pr(repo, number, title, head, { org = ORGS.acme, on = 'main', author = 'mara', bot = false, draft = false, review = null, checks = 'SUCCESS', mergeable = 'MERGEABLE', activeAgo }) {
  return {
    org,
    repo,
    number,
    title,
    head,
    base: on,
    defaultBranch: 'main',
    draft,
    author,
    authorIsBot: bot,
    mergeable,
    review,
    checks,
    activeAt: ago(activeAgo),
    url: `https://github.com/${org}/${repo}/pull/${number}`,
  };
}

export const pulls = [
  // a stack of three, plus a fix and some older work
  pr('storefront', 410, 'Checkout: payment API', 'feat/checkout-api', { review: 'APPROVED', activeAgo: 52 }),
  pr('storefront', 411, 'Checkout: new payment step UI', 'feat/checkout-ui', { on: 'feat/checkout-api', activeAgo: 31 }),
  pr('storefront', 412, 'Checkout: end-to-end tests for card and invoice', 'feat/checkout-e2e', { on: 'feat/checkout-ui', checks: 'PENDING', activeAgo: 4 }),
  pr('storefront', 415, 'Fix rounding of cart totals with discounts', 'fix/cart-rounding', { author: 'jonas', checks: 'PENDING', activeAgo: 2 }),
  pr('storefront', 398, 'Product search with typo tolerance', 'feat/fuzzy-search', { author: 'li-wei', draft: true, activeAgo: 9 * DAY }),
  pr('storefront', 377, 'Experiment: server-side rendering', 'exp/ssr', { author: 'sam', draft: true, mergeable: 'CONFLICTING', activeAgo: 45 * DAY }),
  pr('storefront', 420, 'Update dependency vite to v8', 'renovate/vite-8.x', { author: 'renovate', bot: true, activeAgo: 60 }),
  pr('storefront', 421, 'Update dependency playwright to v1.63', 'renovate/playwright-1.x', { author: 'renovate', bot: true, activeAgo: 70 }),

  pr('design-system', 57, 'Design tokens v2', 'feat/tokens-v2', { author: 'li-wei', review: 'APPROVED', activeAgo: 120 }),
  pr('design-system', 58, 'Dark mode on top of tokens v2', 'feat/dark-mode', { author: 'li-wei', on: 'feat/tokens-v2', checks: 'PENDING', activeAgo: 1 }),
  pr('design-system', 59, 'Focus rings that pass WCAG 2.2', 'fix/focus-rings', { author: 'sam', on: 'feat/tokens-v2', activeAgo: 95 }),

  pr('api', 233, 'Rate limits per API key', 'feat/rate-limits', { author: 'jonas', review: 'CHANGES_REQUESTED', checks: 'PENDING', activeAgo: 3 }),
  pr('api', 234, 'Rate limit headers in every response', 'feat/rate-limit-headers', { author: 'jonas', on: 'feat/rate-limits', activeAgo: 44 }),
  pr('api', 230, 'Move to Node 24', 'chore/node-24', { author: 'sam', draft: true, checks: 'FAILURE', activeAgo: 20 * 60 }),
  pr('api', 236, 'Bump undici from 7.10 to 7.16', 'dependabot/npm/undici-7.16', { author: 'dependabot', bot: true, activeAgo: 3 * DAY }),

  pr('mobile-app', 88, 'Offline sync for orders', 'feat/offline-sync', { author: 'mara', checks: 'PENDING', activeAgo: 11 }),
  pr('mobile-app', 85, 'Push notifications for shipped orders', 'feat/push', { author: 'li-wei', mergeable: 'CONFLICTING', activeAgo: 3 * DAY }),

  pr('billing', 91, 'Tax rates for 2027', 'fix/tax-2027', { org: ORGS.labs, author: 'sam', review: 'APPROVED', activeAgo: 5 * 60 }),
  pr('billing', 92, 'New invoice PDF layout', 'feat/invoice-layout', { org: ORGS.labs, author: 'mara', on: 'feat/invoice-templates', activeAgo: 30 * 60 }),

  pr('infra', 19, 'Kubernetes 1.34', 'chore/k8s-1.34', { org: ORGS.labs, author: 'jonas', checks: 'FAILURE', activeAgo: 9 }),

  pr('docs', 12, 'Rewrite the getting started guide', 'docs/getting-started', { author: 'sam', checks: null, activeAgo: 60 * DAY }),
  pr('legacy-site', 301, 'Update dependency jquery to v4', 'renovate/jquery-4.x', { author: 'renovate', bot: true, activeAgo: 2 * DAY }),
];

/** What the browser would have learnt from earlier runs: the base of "~3m left". */
export const jobDurations = Object.fromEntries(
  running
    .filter((j) => !j.githubHosted)
    .map((j, i) => {
      const minutes = { 'e2e (chromium)': 7.4, 'unit tests': 2.5, build: 3.2, 'deploy (staging)': 8.9, 'build & test': 14.6 }[j.name];
      const key = [j.org, j.repo, j.workflow, j.name].join('/');
      return [key, minutes ? [{ id: i + 1, completedAt: ago(DAY), ms: minutes * 60_000 }] : []];
    }),
);
