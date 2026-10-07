// Which host a runner lives on, for grouping runners into cards. In order:
//   1. a runner label "<HOST_LABEL_PREFIX><host>", e.g. host:build-1
//   2. the named group "host" of RUNNER_NAME_PATTERN
//   3. none: the caller groups by org instead
// HOST_NAMES then maps the result to a display name.

import type { RunnerNaming } from '../config.ts';

/** Ephemeral runners vanish after their job; remember enough to label recent jobs. */
const MAX_KNOWN = 500;

export class HostResolver {
  private readonly naming: RunnerNaming;
  /** runner name → host key, learnt from labels (jobs only carry the runner name) */
  private readonly known = new Map<string, string>();

  constructor(naming: RunnerNaming) {
    this.naming = naming;
  }

  /** Host of a listed runner; also remembers it for that runner's jobs. */
  ofRunner(name: string, labels: string[]): string | null {
    const label = labels.find((l) => this.isHostLabel(l));
    if (label) {
      const key = label.slice(this.naming.labelPrefix.length);
      this.known.delete(name);
      this.known.set(name, key);
      if (this.known.size > MAX_KNOWN) this.known.delete(this.known.keys().next().value!);
      return this.display(key);
    }
    return this.fromName(name);
  }

  /** Host of the runner a job ran on, from what is known about that runner name. */
  ofRunnerName(name: string): string | null {
    const key = this.known.get(name);
    return key !== undefined ? this.display(key) : this.fromName(name);
  }

  /** The pattern's "id" group (e.g. a random suffix), else the full name. */
  shortName(name: string): string {
    return this.naming.pattern?.exec(name)?.groups?.['id'] ?? name;
  }

  isHostLabel(label: string): boolean {
    return this.naming.labelPrefix !== '' && label.startsWith(this.naming.labelPrefix);
  }

  private fromName(name: string): string | null {
    const key = this.naming.pattern?.exec(name)?.groups?.['host'];
    return key ? this.display(key) : null;
  }

  private display(key: string): string {
    return this.naming.hostNames.get(key) ?? key;
  }
}
