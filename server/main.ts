// Entry point: wires orgs, job store, runner list, pull requests, stream and
// HTTP server, then fills the store once (bootstrap) and keeps it honest
// (reconcile).

import { createServer } from 'node:http';
import { buildSnapshot } from './build-snapshot.ts';
import { loadConfig } from './config.ts';
import { routes } from './http/routes.ts';
import { webhookHandler } from './http/webhook.ts';
import { bootstrap } from './jobs/bootstrap.ts';
import { JobStore } from './jobs/job-store.ts';
import { reconcile } from './jobs/reconcile.ts';
import { RunDetailsCache } from './jobs/run-details.ts';
import { Org } from './org.ts';
import { PullList } from './pulls/pull-list.ts';
import { HostResolver } from './runners/host-resolver.ts';
import { RunnerList } from './runners/runner-list.ts';
import { SnapshotStream } from './snapshot-stream.ts';

const RECONCILE_EVERY_MS = 60_000;
const PULLS_CHECK_EVERY_MS = 60_000;

const config = loadConfig();
const orgs = config.orgs.map((o) => new Org(o.name, o.label, o.token, o.webhookSecret));
const hosts = new HostResolver(config.naming);
const store = new JobStore();
const runs = new RunDetailsCache();
const runnerList = new RunnerList(orgs, hosts);
const pulls = new PullList();
const stream = new SnapshotStream(
  () => buildSnapshot({ title: config.title, runnerList, store, orgs, hosts }),
  () => pulls.all(),
  runnerList,
  config.pollMs,
);
store.onChange(() => stream.publish());
pulls.onChange(() => stream.publishPulls());

const webhook = webhookHandler({ orgs, store, runs, pulls, onDelivery: () => stream.publish() });
const server = createServer(
  routes({ stream, webhook, staticDir: config.staticDir, auth: config.auth, realm: config.title }),
);

server.listen(config.port, () => {
  console.log(`runner-dashboard on :${config.port}, orgs ${orgs.map((o) => o.name).join(', ')}`);
  if (!config.auth) console.warn('no Basic Auth (ALLOW_ANONYMOUS=true): protect this server another way');
  for (const org of orgs.filter((o) => !o.webhookSecret)) {
    console.warn(`[${org.name}] no webhook secret: jobs only update via reconcile (5 min)`);
  }
});

for (const org of orgs) {
  bootstrap(org, store, runs).catch((err) => {
    console.error(`[${org.name}] bootstrap`, err);
    org.errors.bootstrap = `bootstrap failed: ${err}`;
  });
}
for (const org of orgs) void pulls.refreshOrg(org);
setInterval(() => void reconcile(orgs, store, runs), RECONCILE_EVERY_MS);
setInterval(() => stream.watched && pulls.refreshStale(orgs), PULLS_CHECK_EVERY_MS);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    stream.close();
    server.close(() => process.exit(0));
  });
}
