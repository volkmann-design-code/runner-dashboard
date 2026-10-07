import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from './config.ts';

const base = { GITHUB_ORGS: 'my-org', GITHUB_TOKEN: 't', BASIC_AUTH_USERNAME: 'u', BASIC_AUTH_PASSWORD: 'p' };

describe('loadConfig', () => {
  it('requires GITHUB_ORGS', () => {
    assert.throws(() => loadConfig({ ...base, GITHUB_ORGS: undefined }), /GITHUB_ORGS/);
  });

  it('prefers a per-org token over GITHUB_TOKEN', () => {
    const config = loadConfig({ ...base, GITHUB_ORGS: 'my-org, Other-Org', GITHUB_TOKEN_OTHER_ORG: 'other' });
    assert.deepEqual(
      config.orgs.map((o) => [o.name, o.token]),
      [['my-org', 't'], ['Other-Org', 'other']],
    );
  });

  it('labels orgs from ORG_LABELS, else by name', () => {
    const config = loadConfig({ ...base, GITHUB_ORGS: 'my-org,other', ORG_LABELS: 'my-org=mine' });
    assert.deepEqual(config.orgs.map((o) => o.label), ['mine', 'other']);
  });

  it('refuses to run without login unless ALLOW_ANONYMOUS=true', () => {
    const open = { ...base, BASIC_AUTH_USERNAME: undefined, BASIC_AUTH_PASSWORD: undefined };
    assert.throws(() => loadConfig(open), /ALLOW_ANONYMOUS/);
    assert.equal(loadConfig({ ...open, ALLOW_ANONYMOUS: 'true' }).auth, null);
  });

  it('rejects half a Basic Auth config', () => {
    assert.throws(() => loadConfig({ ...base, BASIC_AUTH_PASSWORD: undefined }), /both/);
  });

  it('needs a host group in RUNNER_NAME_PATTERN', () => {
    assert.throws(() => loadConfig({ ...base, RUNNER_NAME_PATTERN: '^(.+)$' }), /host/);
  });
});
