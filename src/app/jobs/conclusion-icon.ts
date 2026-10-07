import { Component, computed, input } from '@angular/core';

const ICONS: Record<string, { icon: string; tone: string }> = {
  success: { icon: '✓', tone: 'text-emerald-600' },
  failure: { icon: '✕', tone: 'text-red-600' },
  cancelled: { icon: '⊘', tone: 'text-zinc-400' },
};
const OTHER = { icon: '·', tone: 'text-zinc-400' };

/** A finished job's result as one symbol. */
@Component({
  selector: 'app-conclusion-icon',
  host: { class: 'w-4 shrink-0 text-center font-bold', '[class]': 'style().tone', '[title]': 'conclusion() ?? ""' },
  template: `{{ style().icon }}`,
})
export class ConclusionIcon {
  readonly conclusion = input.required<string | null>();

  protected readonly style = computed(() => ICONS[this.conclusion() ?? ''] ?? OTHER);
}
