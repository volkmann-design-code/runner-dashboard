import type { Snapshot } from '../../../shared/snapshot';
import { countsOf } from './counts';

const DEFAULT_TITLE = 'Runners';
const COLORS = { ok: '#10b981', queued: '#f59e0b', problem: '#ef4444', disconnected: '#a1a1aa' };

/**
 * "3/12 busy" in the tab title and a colored dot as favicon, readable while
 * the tab is in the background:
 * green = nothing waiting, orange = jobs queued, red = runner offline or org
 * error, grey = disconnected.
 *
 * Plain DOM on purpose: called straight from the EventSource handler, so it
 * does not depend on Angular rendering, which browsers throttle in hidden tabs.
 */
export function showTabStatus(snapshot: Snapshot | null, connected: boolean): void {
  if (!snapshot || !connected) {
    document.title = snapshot?.title ?? DEFAULT_TITLE;
    setFavicon(COLORS.disconnected);
    return;
  }
  const c = countsOf(snapshot);
  document.title = `${c.busy}/${c.online} busy · ${snapshot.title}`;
  setFavicon(
    c.offline > 0 || c.errors > 0 ? COLORS.problem : c.queued > 0 ? COLORS.queued : COLORS.ok,
  );
}

function setFavicon(color: string): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${color}"/></svg>`;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
