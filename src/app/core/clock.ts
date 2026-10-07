import { Injectable, signal } from '@angular/core';

/** Ticks every second so durations count up between snapshots. */
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(Date.now());

  constructor() {
    setInterval(() => this.now.set(Date.now()), 1000);
  }
}
