// Combines runners, jobs and org status into what the browser gets, and
// links each busy runner to the job it is running.

import type { Job, Snapshot } from '../shared/snapshot.ts';
import type { JobStore } from './jobs/job-store.ts';
import type { Org } from './org.ts';
import type { HostResolver } from './runners/host-resolver.ts';
import type { RunnerList } from './runners/runner-list.ts';

export interface SnapshotSources {
  title: string;
  runnerList: RunnerList;
  store: JobStore;
  orgs: Org[];
  hosts: HostResolver;
}

export function buildSnapshot({ title, runnerList, store, orgs, hosts }: SnapshotSources): Snapshot {
  // resolved now, not when the job arrived: the runner may have been listed since
  const withRunner = (j: Job): Job =>
    j.runnerName && !j.githubHosted
      ? { ...j, runnerHost: hosts.ofRunnerName(j.runnerName) ?? j.org, runnerShortName: hosts.shortName(j.runnerName) }
      : j;
  const activeJobs = store.active().map(withRunner);
  const jobByRunner = new Map(
    activeJobs.filter((j) => j.status === 'in_progress').map((j) => [j.runnerName, j.id]),
  );
  const runners = runnerList.runners
    .map((r) => ({ ...r, jobId: jobByRunner.get(r.name) ?? null }))
    .sort((a, b) => a.host.localeCompare(b.host) || a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    title,
    runners,
    activeJobs,
    recentJobs: store.recent().map(withRunner),
    orgs: orgs.map((o) => o.status()),
  };
}
