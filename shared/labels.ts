// Labels every self-hosted runner gets from GitHub; not worth showing.
// Used by server and browser, so no imports.

export const DEFAULT_LABELS: ReadonlySet<string> = new Set([
  'self-hosted',
  'linux',
  'windows',
  'macos',
  'x64',
  'arm',
  'arm64',
]);

export function isDefaultLabel(label: string): boolean {
  return DEFAULT_LABELS.has(label.toLowerCase());
}
