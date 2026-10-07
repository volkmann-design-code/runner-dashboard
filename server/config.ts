// Everything the server reads from the environment (see README → Configuration).

import { join } from 'node:path';

export interface OrgConfig {
  name: string;
  /** Badge text next to runners, jobs and repos, shown when more than one org is watched. */
  label: string;
  token: string;
  webhookSecret: string | null;
}

export interface RunnerNaming {
  /** A runner label starting with this names its host, e.g. "host:" for host:build-1. */
  labelPrefix: string;
  /** Matched against runner names; named groups "host" and optionally "id". */
  pattern: RegExp | null;
  /** Host key → display name. */
  hostNames: ReadonlyMap<string, string>;
}

export interface BasicAuth {
  username: string;
  password: string;
}

export interface Config {
  port: number;
  pollMs: number;
  staticDir: string;
  title: string;
  orgs: OrgConfig[];
  naming: RunnerNaming;
  /** null: no login, only allowed with ALLOW_ANONYMOUS=true. */
  auth: BasicAuth | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const orgNames = list(required(env['GITHUB_ORGS'], 'GITHUB_ORGS'));
  if (orgNames.length === 0) throw new Error('GITHUB_ORGS names no org');
  const orgLabels = pairs(env['ORG_LABELS']);

  return {
    port: Number(env['PORT'] ?? 8080),
    pollMs: Number(env['POLL_INTERVAL_SECONDS'] ?? 10) * 1000,
    staticDir: env['STATIC_DIR'] ?? join(import.meta.dirname, '../dist/runner-dashboard/browser'),
    title: env['DASHBOARD_TITLE'] || 'Runners',
    orgs: orgNames.map((name) => ({
      name,
      label: orgLabels.get(name) ?? name,
      token: required(perOrg('GITHUB_TOKEN', name, env), `GITHUB_TOKEN_${suffix(name)} or GITHUB_TOKEN`),
      webhookSecret: perOrg('GITHUB_WEBHOOK_SECRET', name, env) ?? null,
    })),
    naming: {
      labelPrefix: env['HOST_LABEL_PREFIX'] ?? 'host:',
      pattern: namePattern(env['RUNNER_NAME_PATTERN']),
      hostNames: pairs(env['HOST_NAMES']),
    },
    auth: basicAuth(env),
  };
}

function basicAuth(env: NodeJS.ProcessEnv): BasicAuth | null {
  const username = env['BASIC_AUTH_USERNAME'];
  const password = env['BASIC_AUTH_PASSWORD'];
  if (username && password) return { username, password };
  if (username || password) throw new Error('Set both BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD');
  // The page shows repo names, branches and PRs, private ones included.
  if (env['ALLOW_ANONYMOUS'] === 'true') return null;
  throw new Error(
    'Set BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD, or ALLOW_ANONYMOUS=true if a proxy in front handles login',
  );
}

function namePattern(source: string | undefined): RegExp | null {
  if (!source) return null;
  const pattern = new RegExp(source);
  if (!source.includes('(?<host>')) throw new Error('RUNNER_NAME_PATTERN needs a named group (?<host>…)');
  return pattern;
}

// <PREFIX>_<ORG> (e.g. GITHUB_TOKEN_MY_ORG), else <PREFIX>.
// A fine-grained PAT belongs to one org, so watching several orgs needs one per org.
function perOrg(prefix: string, org: string, env: NodeJS.ProcessEnv): string | undefined {
  return env[`${prefix}_${suffix(org)}`] ?? env[prefix];
}

function suffix(org: string): string {
  return org.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function list(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

// "a=x,b=y"
function pairs(value: string | undefined): Map<string, string> {
  return new Map(
    list(value ?? '').map((pair) => {
      const i = pair.indexOf('=');
      return [pair.slice(0, i).trim(), pair.slice(i + 1).trim()] as [string, string];
    }),
  );
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
