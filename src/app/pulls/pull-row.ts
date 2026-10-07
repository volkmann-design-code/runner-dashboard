import { Component, computed, input } from '@angular/core';
import type { StackRow } from './stacks';

/** Jobs of this PR on any runner right now, from the snapshot's active jobs. */
export type LiveState = 'running' | 'queued' | null;

const CHECKS: Record<string, { icon: string; tone: string; title: string }> = {
  SUCCESS: { icon: '✓', tone: 'text-emerald-600', title: 'checks passed' },
  FAILURE: { icon: '✕', tone: 'text-red-600', title: 'checks failed' },
  ERROR: { icon: '✕', tone: 'text-red-600', title: 'checks errored' },
  PENDING: { icon: '●', tone: 'text-amber-500 text-[0.6rem]', title: 'checks pending' },
  EXPECTED: { icon: '●', tone: 'text-amber-500 text-[0.6rem]', title: 'checks expected' },
};
const NO_CHECKS = { icon: '·', tone: 'text-zinc-400', title: 'no checks' };

/**
 * One PR in a stack: tree lines, a status icon (a job running or queued
 * right now, else the combined checks), title and head branch. Columns are
 * 1rem wide and lines sit at their center, so a child's connector meets
 * its parent's icon.
 */
@Component({
  selector: 'app-pull-row',
  // hover and highlight: PrHighlight, set where the row is used
  host: { class: 'flex text-sm' },
  template: `
    @for (rail of row().rails; track $index) {
      <span class="relative w-4 shrink-0">
        @if (rail) {
          <span class="absolute inset-y-0 left-2 border-l border-zinc-300 dark:border-zinc-700"></span>
        }
      </span>
    }
    @if (row().depth > 0) {
      <span class="relative w-4 shrink-0">
        <span class="absolute top-0 left-2 h-4 border-l border-zinc-300 dark:border-zinc-700"></span>
        <span class="absolute top-4 left-2 w-2 border-t border-zinc-300 dark:border-zinc-700"></span>
        @if (!row().last) {
          <span class="absolute top-4 bottom-0 left-2 border-l border-zinc-300 dark:border-zinc-700"></span>
        }
      </span>
    }
    <span class="relative flex h-8 w-4 shrink-0 items-center justify-center font-bold" [title]="status().title">
      @if (live()) {
        <span class="size-2 rounded-full" [class]="live() === 'running' ? 'animate-pulse bg-amber-500' : 'bg-zinc-400'"></span>
      } @else {
        <span [class]="status().tone">{{ status().icon }}</span>
      }
    </span>
    @if (row().hasChildren) {
      <span class="relative -ml-4 w-4 shrink-0">
        <span class="absolute top-6 bottom-0 left-2 border-l border-zinc-300 dark:border-zinc-700"></span>
      </span>
    }
    <a [href]="pr().url" target="_blank" rel="noopener" class="group min-w-0 flex-1 py-1.5 pr-3 pl-1.5" [title]="pr().title">
      <span class="flex min-w-0 items-baseline gap-1.5">
        <span class="shrink-0 text-xs tabular-nums text-zinc-500">#{{ pr().number }}</span>
        <span class="truncate group-hover:underline" [class.text-zinc-400]="pr().draft">{{ pr().title }}</span>
      </span>
      <span class="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
        <span class="truncate font-mono" [title]="pr().head + ' → ' + pr().base">⎇ {{ pr().head }}</span>
        @if (row().orphan) {
          <span class="shrink-0 rounded bg-amber-50 px-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            [title]="'Base ' + pr().base + ' is not ' + pr().defaultBranch + ' and has no open PR. Parent merged?'">→ {{ pr().base }}</span>
        }
        @if (pr().draft) {
          <span class="shrink-0 rounded bg-zinc-100 px-1 dark:bg-zinc-800">draft</span>
        }
        @if (pr().mergeable === 'CONFLICTING') {
          <span class="shrink-0 rounded bg-red-50 px-1 text-red-700 dark:bg-red-950 dark:text-red-300">conflict</span>
        }
        @if (pr().review === 'APPROVED') {
          <span class="shrink-0 text-emerald-600" title="approved">approved</span>
        } @else if (pr().review === 'CHANGES_REQUESTED') {
          <span class="shrink-0 text-amber-600" title="changes requested">changes</span>
        }
      </span>
    </a>
  `,
})
export class PullRow {
  readonly row = input.required<StackRow>();
  readonly live = input<LiveState>(null);

  protected readonly pr = computed(() => this.row().pr);
  protected readonly status = computed(() => {
    const live = this.live();
    if (live) return { icon: '', tone: '', title: live === 'running' ? 'job running' : 'job queued' };
    return CHECKS[this.pr().checks ?? ''] ?? NO_CHECKS;
  });
}
