// The browser routes are read-only and need Basic Auth when it is configured.
// /api/webhook is public and checks GitHub's signature instead; /healthz is
// public for container probes.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { BasicAuth } from '../config.ts';
import type { SnapshotStream } from '../snapshot-stream.ts';
import { isAuthorized } from './basic-auth.ts';
import { serveStatic } from './static-files.ts';

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export interface RouteDeps {
  stream: SnapshotStream;
  webhook: Handler;
  staticDir: string;
  auth: BasicAuth | null;
  /** Shown in the browser's login prompt. */
  realm: string;
}

export function routes({ stream, webhook, staticDir, auth, realm }: RouteDeps) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/webhook') {
      // this path bypasses Basic Auth, so it must not fall through to the page
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' }).end();
        return;
      }
      webhook(req, res).catch((err) => {
        console.error('webhook', err);
        if (!res.headersSent) res.writeHead(400).end();
      });
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
    } else if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    } else if (auth && !isAuthorized(req, auth)) {
      res
        .writeHead(401, { 'WWW-Authenticate': `Basic realm="${realm.replace(/"/g, '')}", charset="UTF-8"` })
        .end();
    } else if (url.pathname === '/api/events') {
      stream.subscribe(res, url.searchParams.get('visible') !== '0');
    } else if (url.pathname === '/api/snapshot') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(stream.current()));
    } else if (url.pathname === '/api/pulls') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(stream.currentPulls()));
    } else {
      void serveStatic(staticDir, url.pathname, res);
    }
  };
}
