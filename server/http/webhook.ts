// POST /api/webhook: GitHub's org webhooks (events "Workflow jobs", "Pull
// requests", "Pull request reviews", "Statuses" and "Check suites").
// Reachable without Basic Auth (GitHub cannot send it), so every delivery
// must carry a valid signature for one of the configured orgs.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GhRepoEvent, GhWorkflowJobEvent } from '../github/types.ts';
import { isValidSignature } from '../github/webhook-signature.ts';
import type { JobStore } from '../jobs/job-store.ts';
import type { RunDetailsCache } from '../jobs/run-details.ts';
import { toJob } from '../mapping.ts';
import type { Org } from '../org.ts';
import type { PullList } from '../pulls/pull-list.ts';

const MAX_BODY_BYTES = 2 * 1024 * 1024; // workflow_job payloads are ~10 KB, pull_request ~30 KB
/**
 * Events that change a repo's open PRs or their checks; they only tell us
 * which repo to re-read, the payload itself is not used. status and
 * check_suite cover checks that are not Actions jobs (e.g. CodeRabbit).
 */
const PULL_EVENTS = new Set(['pull_request', 'pull_request_review', 'status', 'check_suite']);

export interface WebhookDeps {
  orgs: Org[];
  store: JobStore;
  runs: RunDetailsCache;
  pulls: PullList;
  /** Called after any accepted delivery, so org status (last webhook) updates too. */
  onDelivery: () => void;
}

export function webhookHandler(deps: WebhookDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readBody(req).catch(() => null);
    if (!body) {
      res.writeHead(413).end();
      return;
    }
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const org = deps.orgs.find(
      (o) => o.webhookSecret && isValidSignature(body, signature, o.webhookSecret),
    );
    if (!org) {
      res.writeHead(401).end('bad signature');
      return;
    }

    const event = String(req.headers['x-github-event']);
    if (event !== 'workflow_job' && !PULL_EVENTS.has(event)) {
      res.writeHead(event === 'ping' ? 200 : 204).end();
      return;
    }
    const payload = JSON.parse(body.toString('utf8')) as GhRepoEvent;
    // GitHub logins are case-insensitive, GITHUB_ORGS may differ in case
    if (payload.organization?.login.toLowerCase() !== org.name.toLowerCase()) {
      res.writeHead(403).end('signed for another org');
      return;
    }
    // GitHub waits at most 10 s for an answer; the run lookup happens after it.
    res.writeHead(202).end();

    org.lastWebhookAt = new Date();
    const repo = payload.repository.name;
    if (PULL_EVENTS.has(event)) {
      deps.pulls.refreshRepoSoon(org, repo);
    } else {
      const job = (payload as GhWorkflowJobEvent).workflow_job;
      const details = await deps.runs.get(org, repo, job.run_id);
      deps.store.upsert(toJob(job, org.name, repo, details));
      // the PR's checks changed
      if (job.status === 'completed' && details?.pr) deps.pulls.refreshRepoSoon(org, repo);
    }
    deps.onDelivery();
  };
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
