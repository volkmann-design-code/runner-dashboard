import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HostResolver } from './host-resolver.ts';

const resolver = (pattern?: string, hostNames: Record<string, string> = {}) =>
  new HostResolver({
    labelPrefix: 'host:',
    pattern: pattern ? new RegExp(pattern) : null,
    hostNames: new Map(Object.entries(hostNames)),
  });

describe('HostResolver', () => {
  it('reads the host from a label', () => {
    assert.equal(resolver().ofRunner('runner-1', ['self-hosted', 'host:build-1']), 'build-1');
  });

  it('reads the host from the name pattern', () => {
    const r = resolver('^[^-]+-(?<host>.+)-(?<id>[^-]{6})[^-]*$');
    assert.equal(r.ofRunner('acme-big-box-1-5lTdlxFIcI5r0', []), 'big-box-1');
    assert.equal(r.shortName('acme-big-box-1-5lTdlxFIcI5r0'), '5lTdlx');
  });

  it('prefers the label over the pattern', () => {
    const r = resolver('^(?<host>[^-]+)-');
    assert.equal(r.ofRunner('a-b', ['host:c']), 'c');
  });

  it('maps host keys to display names', () => {
    assert.equal(resolver(undefined, { srv1: 'build' }).ofRunner('x', ['host:srv1']), 'build');
  });

  it('returns null without label or matching pattern', () => {
    assert.equal(resolver().ofRunner('runner-1', ['self-hosted']), null);
    assert.equal(resolver('^ci-(?<host>.+)$').ofRunner('runner-1', []), null);
    assert.equal(resolver().shortName('runner-1'), 'runner-1');
  });

  it('remembers label hosts for jobs of runners that are gone', () => {
    const r = resolver();
    r.ofRunner('ephemeral-1', ['host:build-1']);
    assert.equal(r.ofRunnerName('ephemeral-1'), 'build-1');
    assert.equal(r.ofRunnerName('never-listed'), null);
  });
});
