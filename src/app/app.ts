import { Component, computed, inject } from '@angular/core';
import type { Job, Runner } from '../../shared/snapshot';
import { JobDurations } from './core/job-durations';
import { LiveSnapshot } from './core/live-snapshot';
import { GithubCard } from './hosts/github-card';
import { HostCard } from './hosts/host-card';
import { JobList } from './jobs/job-list';
import { PageHeader } from './page-header';
import { PullSidebar } from './pulls/pull-sidebar';
import { PullView } from './pulls/pull-view';
import { OrgStatusLine } from './summary/org-status-line';
import { StatsBar } from './summary/stats-bar';

@Component({
  selector: 'app-root',
  imports: [GithubCard, HostCard, JobList, OrgStatusLine, PageHeader, PullSidebar, StatsBar],
  template: `
    <!--
      One grid for the page. Wide screens: two columns, headers in the first row
      (runners left, pull requests right), content below with the PR cards
      sticky. Narrower: one column in source order, pull requests last.
    -->
    <div class="mx-auto grid max-w-6xl items-start gap-4 px-4 py-6 xl:max-w-[96rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <app-page-header class="xl:col-start-1 xl:row-start-1 xl:self-center" [title]="snap()?.title ?? 'Runners'" [updatedAt]="snap()?.generatedAt" />

      @if (snap(); as s) {
        <div class="flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-start-2">
          @for (o of s.orgs; track o.org) {
            @if (o.error) {
              <p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                <span class="font-medium">{{ o.org }}:</span> {{ o.error }}
              </p>
            }
          }

          <app-stats-bar [snapshot]="s" />
          <app-github-card [jobs]="githubJobs()" />

          <div class="grid gap-4 lg:grid-cols-2">
            @for (h of hosts(); track h.host) {
              <app-host-card [host]="h.host" [runners]="h.runners" [jobs]="jobsById()" />
            }
          </div>

          <app-job-list title="Queued" kind="queued" [jobs]="queued()" empty="No job waiting" />
          <app-job-list title="Recently finished" kind="recent" [jobs]="s.recentJobs" empty="No finished jobs in the last 12 hours" />
        </div>

        <h2 class="mt-2 flex items-baseline gap-2 px-1 text-xl font-semibold xl:col-start-2 xl:row-start-1 xl:mt-0 xl:self-center">
          Pull requests <span class="text-sm font-normal tabular-nums text-zinc-500">{{ pullView.count() }}</span>
        </h2>
        <!-- p-px: the scroll container would clip the cards' 1px rings -->
        <app-pull-sidebar class="xl:sticky xl:top-6 xl:col-start-2 xl:row-start-2 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:p-px"
          [activeJobs]="s.activeJobs" />

        <app-org-status-line class="xl:col-span-2" [orgs]="s.orgs" />
      } @else {
        <p class="py-24 text-center text-zinc-400 xl:col-span-2">Loading runners…</p>
      }
    </div>
  `,
})
export class App {
  protected readonly snap = inject(LiveSnapshot).snapshot;
  protected readonly pullView = inject(PullView);

  constructor() {
    // Created up front so it learns from finished jobs even while no job is running.
    inject(JobDurations);
  }

  protected readonly jobsById = computed(
    () => new Map((this.snap()?.activeJobs ?? []).map((j): [number, Job] => [j.id, j])),
  );
  protected readonly queued = computed(() =>
    (this.snap()?.activeJobs ?? []).filter((j) => !j.githubHosted && j.status !== 'in_progress'),
  );
  protected readonly githubJobs = computed(() => (this.snap()?.activeJobs ?? []).filter((j) => j.githubHosted));
  protected readonly hosts = computed(() => {
    const groups = new Map<string, Runner[]>();
    for (const r of this.snap()?.runners ?? []) {
      groups.set(r.host, [...(groups.get(r.host) ?? []), r]);
    }
    return [...groups].map(([host, runners]) => ({ host, runners }));
  });
}
