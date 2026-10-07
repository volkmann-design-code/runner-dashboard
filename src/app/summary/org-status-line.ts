import { Component, inject, input } from '@angular/core';
import type { OrgStatus } from '../../../shared/snapshot';
import { Clock } from '../core/clock';
import { DurationPipe } from '../core/duration-pipe';

/** Per org: last webhook delivery and remaining GitHub API quota. */
@Component({
  selector: 'app-org-status-line',
  host: { class: 'flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400' },
  imports: [DurationPipe],
  template: `
    @for (o of orgs(); track o.org) {
      <span>
        {{ o.org }}:
        @if (o.lastWebhookAt; as at) {
          last webhook {{ at | duration: clock.now() }} ago
        } @else {
          <span class="text-amber-600">no webhook received yet</span>
        }
        · API quota {{ o.rateLimitRemaining ?? '?' }} left
      </span>
    }
  `,
})
export class OrgStatusLine {
  readonly orgs = input.required<OrgStatus[]>();

  protected readonly clock = inject(Clock);
}
