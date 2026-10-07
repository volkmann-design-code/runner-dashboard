import { Pipe, PipeTransform } from '@angular/core';

/**
 * Time between two instants, e.g. "4m 07s".
 *   {{ job.startedAt | duration: clock.now() }}       running for
 *   {{ job.startedAt | duration: job.completedAt }}   took
 */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(from: string | null, to: string | number | null): string {
    if (!from || to === null) return '–';
    const end = typeof to === 'number' ? to : Date.parse(to);
    return format(end - Date.parse(from));
  }
}

function format(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d`;
}
