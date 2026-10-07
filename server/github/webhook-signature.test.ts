import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { isValidSignature } from './webhook-signature.ts';

const body = Buffer.from('{"hello":"world"}');
const sign = (secret: string) => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

describe('isValidSignature', () => {
  it('accepts the right secret', () => assert.equal(isValidSignature(body, sign('s3cret'), 's3cret'), true));
  it('rejects another secret', () => assert.equal(isValidSignature(body, sign('other'), 's3cret'), false));
  it('rejects a missing or malformed header', () => {
    assert.equal(isValidSignature(body, undefined, 's3cret'), false);
    assert.equal(isValidSignature(body, 'sha1=abc', 's3cret'), false);
    assert.equal(isValidSignature(body, 'sha256=abc', 's3cret'), false);
  });
});
