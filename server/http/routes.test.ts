// Routes and webhook over real HTTP, without GitHub (run details are cached up front).

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { JobStore } from '../jobs/job-store.ts';
import { RunDetailsCache } from '../jobs/run-details.ts';
import { Org } from '../org.ts';
import type { PullList } from '../pulls/pull-list.ts';
import type { SnapshotStream } from '../snapshot-stream.ts';
import { ghJob } from '../test/fixtures.ts';
import { routes } from './routes.ts';
import { webhookHandler } from './webhook.ts';

const SECRET = 'webhook-secret';
const AUTH = 'Basic ' + Buffer.from('user:pass').toString('base64');

describe('routes', () => {
  const store = new JobStore();
  const runs = new RunDetailsCache();
  const org = new Org('My-Org', 'my', 'token', SECRET);
  const stream = { current: () => ({ ok: true }) } as unknown as SnapshotStream;
  /** Repos the webhook asked to re-read. */
  const refreshed: string[] = [];
  const pulls = { refreshRepoSoon: (o: Org, repo: string) => refreshed.push(`${o.name}/${repo}`) } as unknown as PullList;
  let server: Server;
  let base: string;

  before(async () => {
    runs.remember({ id: 10, name: 'CI', run_attempt: 1, status: 'queued', updated_at: '', head_branch: 'main', pull_requests: [{ number: 7 }] });
    const webhook = webhookHandler({ orgs: [org], store, runs, pulls, onDelivery: () => {} });
    server = createServer(
      routes({ stream, webhook, staticDir: '/nonexistent', auth: { username: 'user', password: 'pass' }, realm: 'Test' }),
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  const deliver = (payload: unknown, secret = SECRET, event = 'workflow_job') => {
    const body = JSON.stringify(payload);
    return fetch(`${base}/api/webhook`, {
      method: 'POST',
      body,
      headers: {
        'X-GitHub-Event': event,
        'X-Hub-Signature-256': 'sha256=' + createHmac('sha256', secret).update(body).digest('hex'),
      },
    });
  };

  it('asks for Basic Auth on the page and its API', async () => {
    const res = await fetch(`${base}/api/snapshot`);
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') ?? '', /^Basic realm="Test"/);
  });

  it('serves the API with valid credentials', async () => {
    const res = await fetch(`${base}/api/snapshot`, { headers: { Authorization: AUTH } });
    assert.deepEqual(await res.json(), { ok: true });
  });

  it('keeps /healthz open for probes', async () => {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
  });

  it('only accepts POST on /api/webhook', async () => {
    assert.equal((await fetch(`${base}/api/webhook`, { headers: { Authorization: AUTH } })).status, 405);
  });

  it('rejects a bad webhook signature', async () => {
    assert.equal((await deliver({}, 'wrong')).status, 401);
  });

  it('answers pings', async () => {
    assert.equal((await deliver({ zen: 'hi' }, SECRET, 'ping')).status, 200);
  });

  it('rejects a delivery signed for another org', async () => {
    const res = await deliver({ action: 'queued', workflow_job: ghJob(), repository: { name: 'app' }, organization: { login: 'evil' } });
    assert.equal(res.status, 403);
  });

  it('stores self-hosted jobs with their PR, matching the org case-insensitively', async () => {
    const res = await deliver({ action: 'queued', workflow_job: ghJob(), repository: { name: 'app' }, organization: { login: 'my-org' } });
    assert.equal(res.status, 202);
    await new Promise((resolve) => setTimeout(resolve, 20)); // stored after the answer
    assert.deepEqual(store.active().map((j) => [j.org, j.repo, j.pr]), [['My-Org', 'app', 7]]);
    assert.notEqual(org.lastWebhookAt, null);
  });

  it('keeps jobs for GitHub-hosted runners, marked as such', async () => {
    const hosted = ghJob({ id: 2, labels: ['ubuntu-latest'] });
    await deliver({ action: 'queued', workflow_job: hosted, repository: { name: 'app' }, organization: { login: 'My-Org' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(store.active().filter((j) => j.id === 2).map((j) => [j.githubHosted, j.runnerHost]), [[true, 'github']]);
  });

  it('re-reads the PRs of a repo on pull request, review, status and check suite events', async () => {
    for (const event of ['pull_request', 'pull_request_review', 'status', 'check_suite']) {
      const res = await deliver({ repository: { name: `app-${event}` }, organization: { login: 'My-Org' } }, SECRET, event);
      assert.equal(res.status, 202);
    }
    assert.deepEqual(refreshed, ['My-Org/app-pull_request', 'My-Org/app-pull_request_review', 'My-Org/app-status', 'My-Org/app-check_suite']);
  });

  it('re-reads the PRs of a repo when a job of a PR finishes', async () => {
    refreshed.length = 0;
    const done = ghJob({ id: 3, status: 'completed', conclusion: 'success', completed_at: new Date().toISOString() });
    await deliver({ action: 'completed', workflow_job: done, repository: { name: 'app' }, organization: { login: 'My-Org' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(refreshed, ['My-Org/app']);
  });

  it('ignores other events', async () => {
    assert.equal((await deliver({ repository: { name: 'app' }, organization: { login: 'My-Org' } }, SECRET, 'push')).status, 204);
  });
});
