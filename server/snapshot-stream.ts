// Server-Sent Events: every subscriber gets each new snapshot. Job changes
// arrive by webhook and are pushed right away. Open PRs (a few hundred,
// bots included) go out as their own "pulls" event, only when they change,
// not with every snapshot. The runner list is polled
// while anyone is subscribed: every pollMs if a tab is visible, every
// BACKGROUND_POLL_MS if all tabs are hidden (they only show title/favicon).

import type { ServerResponse } from 'node:http';
import type { PullRequest, Snapshot } from '../shared/snapshot.ts';
import type { RunnerList } from './runners/runner-list.ts';

const KEEPALIVE_MS = 25_000;
const BACKGROUND_POLL_MS = 60_000;
/** Matrix builds send a burst of webhooks; one snapshot per burst is enough. */
const PUBLISH_DEBOUNCE_MS = 250;

export class SnapshotStream {
  /** subscriber → is its tab visible */
  private readonly clients = new Map<ServerResponse, boolean>();
  private pollTimer: NodeJS.Timeout | null = null;
  private pollInFlight = false;
  private publishTimer: NodeJS.Timeout | null = null;
  private pullsTimer: NodeJS.Timeout | null = null;
  private readonly build: () => Snapshot;
  private readonly pulls: () => PullRequest[];
  private readonly runnerList: RunnerList;
  private readonly pollMs: number;

  constructor(build: () => Snapshot, pulls: () => PullRequest[], runnerList: RunnerList, pollMs: number) {
    this.build = build;
    this.pulls = pulls;
    this.runnerList = runnerList;
    this.pollMs = pollMs;
  }

  /** Whether any tab is open, visible or not. */
  get watched(): boolean {
    return this.clients.size > 0;
  }

  current(): Snapshot {
    return this.build();
  }

  currentPulls(): PullRequest[] {
    return this.pulls();
  }

  subscribe(res: ServerResponse, visible: boolean): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    res.write(event(this.build()));
    res.write(event(this.pulls(), 'pulls'));
    this.clients.set(res, visible);
    // keeps proxies from closing an idle stream
    const ping = setInterval(() => res.write(': ping\n\n'), KEEPALIVE_MS);
    res.on('close', () => {
      clearInterval(ping);
      this.clients.delete(res);
    });
    // a tab coming to the front wants fresh runners now, not after the background interval
    const idle = !this.pollTimer && !this.pollInFlight;
    if (idle || visible) this.pollNow();
  }

  /** Push a fresh snapshot to all subscribers (debounced). */
  publish(): void {
    if (this.clients.size === 0 || this.publishTimer) return;
    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      const data = event(this.build());
      for (const res of this.clients.keys()) res.write(data);
    }, PUBLISH_DEBOUNCE_MS);
  }

  /** Push the open PRs to all subscribers (debounced like snapshots). */
  publishPulls(): void {
    if (this.clients.size === 0 || this.pullsTimer) return;
    this.pullsTimer = setTimeout(() => {
      this.pullsTimer = null;
      const data = event(this.pulls(), 'pulls');
      for (const res of this.clients.keys()) res.write(data);
    }, PUBLISH_DEBOUNCE_MS);
  }

  close(): void {
    for (const res of this.clients.keys()) res.end();
  }

  private pollNow(): void {
    if (this.pollInFlight) return; // its follow-up is scheduled by the current visibility
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    void this.pollRunners();
  }

  private async pollRunners(): Promise<void> {
    this.pollInFlight = true;
    try {
      await this.runnerList.refresh();
    } catch (err) {
      console.error('runner poll failed', err);
    } finally {
      this.pollInFlight = false;
    }
    // also when nothing changed: keeps "updated … ago" honest
    this.publish();
    if (this.clients.size === 0) return;
    const anyVisible = [...this.clients.values()].some(Boolean);
    this.pollTimer = setTimeout(
      () => {
        this.pollTimer = null;
        void this.pollRunners();
      },
      anyVisible ? this.pollMs : BACKGROUND_POLL_MS,
    );
  }
}

/** Unnamed events (onmessage) are snapshots; others are named, e.g. "pulls". */
function event(data: unknown, name?: string): string {
  return `${name ? `event: ${name}\n` : ''}data: ${JSON.stringify(data)}\n\n`;
}
