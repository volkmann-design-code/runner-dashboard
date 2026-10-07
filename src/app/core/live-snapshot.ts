import { Injectable, signal } from '@angular/core';
import type { PullRequest, Snapshot } from '../../../shared/snapshot';
import { showTabStatus } from './tab-status';

/**
 * The server's snapshot stream (Server-Sent Events) as signals.
 *
 * The stream stays open in background tabs, so title and favicon stay
 * current. The tab tells the server whether it is visible (by reconnecting
 * with ?visible=0|1); with only hidden tabs the server polls the runner list
 * less often. Job changes arrive by webhook either way. Open PRs come as a
 * separate "pulls" event, only when they change.
 */
@Injectable({ providedIn: 'root' })
export class LiveSnapshot {
  readonly snapshot = signal<Snapshot | null>(null);
  readonly pulls = signal<PullRequest[]>([]);
  readonly connected = signal(false);

  private events: EventSource | null = null;

  constructor() {
    document.addEventListener('visibilitychange', () => this.connect());
    this.connect();
  }

  private connect(): void {
    this.events?.close();
    const events = new EventSource(`api/events?visible=${document.hidden ? 0 : 1}`);
    events.onopen = () => this.setConnected(true);
    events.onerror = () => this.setConnected(false); // EventSource reconnects by itself
    events.onmessage = (e: MessageEvent<string>) => {
      this.snapshot.set(JSON.parse(e.data) as Snapshot);
      this.setConnected(true);
    };
    events.addEventListener('pulls', (e) => this.pulls.set(JSON.parse((e as MessageEvent<string>).data) as PullRequest[]));
    this.events = events;
  }

  private setConnected(connected: boolean): void {
    this.connected.set(connected);
    showTabStatus(this.snapshot(), connected);
  }
}
