// Serves the Angular build; unknown paths get index.html.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

export async function serveStatic(dir: string, path: string, res: ServerResponse): Promise<void> {
  let file = join(dir, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  let info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    file = join(dir, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info) {
    res.writeHead(404).end('not built: run npm run build');
    return;
  }
  const isIndex = file.endsWith('index.html');
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Content-Length': info.size,
    // the Angular build hashes file names, index.html must stay fresh
    'Cache-Control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(file).pipe(res);
}
