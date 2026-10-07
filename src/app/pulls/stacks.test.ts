import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PullRequest } from '../../../shared/snapshot.ts';
import { buildStacks } from './stacks.ts';

function pr(number: number, head: string, base: string, activeAt = '2026-01-01T00:00:00Z'): PullRequest {
  return {
    org: 'my-org',
    repo: 'app',
    number,
    title: `PR ${number}`,
    head,
    base,
    defaultBranch: 'main',
    draft: false,
    author: 'alice',
    authorIsBot: false,
    mergeable: 'MERGEABLE',
    review: null,
    checks: null,
    activeAt,
    url: `https://github.com/my-org/app/pull/${number}`,
  };
}

/** "#1 ├#2 │└#4" style outline of the rows, for compact assertions. */
const outline = (stacks: ReturnType<typeof buildStacks>) =>
  stacks.map((s) => s.rows.map((r) => `${r.rails.map((x) => (x ? '│' : ' ')).join('')}${r.depth ? (r.last ? '└' : '├') : ''}#${r.pr.number}`).join(' '));

describe('buildStacks', () => {
  it('puts a PR on top of the PR whose head is its base, as a tree', () => {
    const all = [pr(1, 'a', 'main'), pr(2, 'b', 'a'), pr(3, 'c', 'a'), pr(4, 'd', 'b')];
    assert.deepEqual(outline(buildStacks(all, all)), ['#1 ├#2 │└#4 └#3']);
  });

  it('orders stacks by latest activity of any of their PRs', () => {
    const all = [pr(1, 'a', 'main', '2026-01-01T00:00:00Z'), pr(2, 'b', 'main', '2026-01-02T00:00:00Z'), pr(3, 'c', 'a', '2026-01-03T00:00:00Z')];
    const stacks = buildStacks(all, all);
    assert.deepEqual(outline(stacks), ['#1 └#3', '#2']);
    assert.equal(stacks[0].activeAt, '2026-01-03T00:00:00Z');
  });

  it('marks a PR whose base is neither the default branch nor an open PR as orphan', () => {
    const all = [pr(1, 'a', 'gone')];
    assert.equal(buildStacks(all, all)[0].rows[0].orphan, true);
  });

  it('makes a PR on top of an excluded one a root, but no orphan', () => {
    const all = [pr(1, 'a', 'main'), pr(2, 'b', 'a')];
    const [stack] = buildStacks([all[1]], all);
    assert.deepEqual([stack.rows[0].pr.number, stack.rows[0].depth, stack.rows[0].orphan], [2, 0, false]);
  });

  it('survives a base/head cycle', () => {
    const all = [pr(1, 'a', 'b'), pr(2, 'b', 'a')];
    assert.doesNotThrow(() => buildStacks(all, all));
  });
});
