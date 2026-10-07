// GitHub signs each delivery: X-Hub-Signature-256: sha256=<HMAC-SHA256 of
// the raw body with the webhook secret>.

import { createHmac, timingSafeEqual } from 'node:crypto';

export function isValidSignature(body: Buffer, header: string | undefined, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(body).digest('hex'));
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
