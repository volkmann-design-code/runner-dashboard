/**
 * Renders the README's screenshots, the same on every run:
 *
 * - `.github/screenshot.png`: light, 1440 × 960 at 2×
 * - `.github/screenshot-dark.png`: the same in dark mode
 *
 * The real dashboard (the build in `dist/`, served by the server's own
 * routes and SSE stream) with made-up data instead of GitHub (`data.mjs`):
 * two orgs, three hosts, jobs and stacked PRs. The browser's clock is frozen
 * at the data's NOW, so durations read the same each time; PR #412 is
 * hovered, so its jobs light up. Pinned Chromium (Playwright) and pinned
 * fonts (Fontsource): Inter replaces the system font, JetBrains Mono the
 * monospace one.
 *
 *   npm run build                                  # in the repository
 *   cd .github/screenshot && npm ci && npx playwright install chromium && npm run screenshot
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { routes } from '../../server/http/routes.ts';
import { SnapshotStream } from '../../server/snapshot-stream.ts';
import { jobDurations, NOW, pulls, snapshot } from './data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', '..', 'dist', 'runner-dashboard', 'browser');
if (!existsSync(join(dist, 'index.html'))) throw new Error('No build: run `npm run build` in the repository first');

const shots = [
  { out: 'screenshot.png', colorScheme: 'light' },
  { out: 'screenshot-dark.png', colorScheme: 'dark' },
];

const font = (path, family, weight) => {
  const file = readFileSync(join(here, 'node_modules', path)).toString('base64');
  return `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url(data:font/woff2;base64,${file}) format("woff2"); }`;
};
const fonts = [
  font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'Inter Variable', '100 900'),
  font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 'JetBrains Mono', 400),
].join('\n');

// the server's own routes and stream; the runner list never changes
const stream = new SnapshotStream(() => snapshot, () => pulls, { refresh: async () => false }, 3_600_000);
const notFound = async (_req, res) => void res.writeHead(404).end();
const server = createServer(routes({ stream, webhook: notFound, staticDir: dist, auth: null, realm: 'Runners' }));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
try {
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 2,
      colorScheme: shot.colorScheme,
    });
    // what a browser that watched these jobs before would know: their usual runtimes
    await context.addInitScript((durations) => localStorage.setItem('jobDurations', durations), JSON.stringify(jobDurations));
    const page = await context.newPage();
    await page.clock.setFixedTime(NOW);
    await page.goto(base);
    await page.addStyleTag({
      content: `${fonts}
        :root { --font-sans: "Inter Variable", sans-serif; --font-mono: "JetBrains Mono", monospace; }`,
    });
    await page.locator('app-pull-row').first().waitFor();
    // over the row's tree lines, not its link: highlight without an underlined title
    await page.locator('app-pull-row', { hasText: '#412' }).hover({ position: { x: 8, y: 8 } });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.screenshot({ path: join(here, '..', shot.out), animations: 'disabled' });
    console.log(`.github/${shot.out}`);
    await context.close();
  }
} finally {
  await browser.close();
  stream.close();
  server.close();
}
// the stream's runner poll stays scheduled (an hour ahead); nothing else to wait for
process.exit(0);
