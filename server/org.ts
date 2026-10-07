// One watched GitHub org: its API client and what the dashboard reports about it.

import type { OrgStatus } from '../shared/snapshot.ts';
import { GitHubClient } from './github/client.ts';

export class Org {
  readonly name: string;
  readonly label: string;
  readonly gh: GitHubClient;
  readonly webhookSecret: string | null;
  lastWebhookAt: Date | null = null;
  /** Last failure per source; shown on the dashboard until that source succeeds again. */
  readonly errors: { runners: string | null; bootstrap: string | null; pulls: string | null } = {
    runners: null,
    bootstrap: null,
    pulls: null,
  };

  constructor(name: string, label: string, token: string, webhookSecret: string | null) {
    this.name = name;
    this.label = label;
    this.gh = new GitHubClient(token);
    this.webhookSecret = webhookSecret;
  }

  status(): OrgStatus {
    return {
      org: this.name,
      label: this.label,
      lastWebhookAt: this.lastWebhookAt?.toISOString() ?? null,
      rateLimitRemaining: this.gh.rateLimitRemaining,
      rateLimitReset: this.gh.rateLimitReset?.toISOString() ?? null,
      error: this.errors.runners ?? this.errors.bootstrap ?? this.errors.pulls,
    };
  }
}
