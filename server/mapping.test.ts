import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toPullRequest } from './mapping.ts';
import { gqlPull } from './test/fixtures.ts';

describe('toPullRequest', () => {
  it('takes activity from commits, comments and reviews, not updatedAt', () => {
    const pr = toPullRequest(
      gqlPull({
        createdAt: '2026-01-01T00:00:00Z',
        commits: { nodes: [{ commit: { committedDate: '2026-01-05T00:00:00Z', statusCheckRollup: null } }] },
        comments: { nodes: [{ createdAt: '2026-01-07T00:00:00Z' }] },
        reviews: { nodes: [{ submittedAt: '2026-01-06T00:00:00Z' }] },
      }),
      'my-org',
    );
    assert.equal(pr.activeAt, '2026-01-07T00:00:00Z');
  });

  it('falls back to the creation date', () => {
    const pr = toPullRequest(gqlPull({ commits: { nodes: [] } }), 'my-org');
    assert.equal(pr.activeAt, '2026-01-01T10:00:00Z');
  });

  it('prefixes fork heads with their owner, so they never match a base', () => {
    const pr = toPullRequest(gqlPull({ isCrossRepository: true, headRepositoryOwner: { login: 'someone' } }), 'my-org');
    assert.equal(pr.head, 'someone:feat/things');
  });

  it('marks bots and reads checks', () => {
    const pr = toPullRequest(gqlPull({ author: { login: 'renovate', __typename: 'Bot' } }), 'my-org');
    assert.equal(pr.authorIsBot, true);
    assert.equal(pr.checks, 'SUCCESS');
  });

  it('copes with fields the token may not read (null)', () => {
    const pr = toPullRequest(
      gqlPull({ repository: { name: 'app', defaultBranchRef: null }, commits: { nodes: [{ commit: { committedDate: '2026-01-02T10:00:00Z', statusCheckRollup: null } }] } }),
      'my-org',
    );
    assert.equal(pr.defaultBranch, 'main');
    assert.equal(pr.checks, null);
  });
});
