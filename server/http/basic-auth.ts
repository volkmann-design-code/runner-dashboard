// Built-in login for the page and its API (BASIC_AUTH_USERNAME/PASSWORD).
// Browsers send the credentials along with EventSource requests, so the
// live stream needs nothing extra.

import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { BasicAuth } from '../config.ts';

export function isAuthorized(req: IncomingMessage, auth: BasicAuth): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  // both checks always run, so timing does not tell which one failed
  const userOk = sameSecret(decoded.slice(0, i), auth.username);
  const passwordOk = sameSecret(decoded.slice(i + 1), auth.password);
  return userOk && passwordOk;
}

// Comparing hashes keeps the comparison constant-time for any input length.
function sameSecret(given: string, expected: string): boolean {
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(given), hash(expected));
}
