import type { PullRequest } from '../../../shared/snapshot';

/** One PR in a stack, flattened in tree order, with what it needs to draw the tree lines. */
export interface StackRow {
  pr: PullRequest;
  depth: number;
  /** Per ancestor level below the root: does that ancestor have siblings after it (line continues)? */
  rails: boolean[];
  /** Last child of its parent: the connector ends here. */
  last: boolean;
  hasChildren: boolean;
  /** Base is neither the default branch nor another open PR's head, e.g. the parent was merged without deleting its branch. */
  orphan: boolean;
}

export interface Stack {
  rows: StackRow[];
  /** Latest activity of any PR in it. */
  activeAt: string;
}

/**
 * Builds the stacks of one repo: a PR whose base is another PR's head sits
 * on top of it. `shown` are the PRs to draw, `all` every open PR of the
 * repo: a PR on top of an excluded one becomes a root, but is no orphan.
 * Stacks are ordered newest first, PRs on the same parent by number.
 */
export function buildStacks(shown: PullRequest[], all: PullRequest[]): Stack[] {
  const byHead = new Map(shown.map((p) => [p.head, p]));
  const allHeads = new Set(all.map((p) => p.head));
  const children = new Map<number, PullRequest[]>();
  const roots: PullRequest[] = [];
  for (const p of shown) {
    const parent = p.base === p.defaultBranch ? undefined : byHead.get(p.base);
    if (parent && parent !== p) children.set(parent.number, [...(children.get(parent.number) ?? []), p]);
    else roots.push(p);
  }

  const stacks = roots.map((root): Stack => {
    const rows: StackRow[] = [];
    const seen = new Set<number>();
    const walk = (pr: PullRequest, depth: number, rails: boolean[], last: boolean): void => {
      if (seen.has(pr.number)) return; // a base/head cycle, should not happen
      seen.add(pr.number);
      const kids = (children.get(pr.number) ?? []).sort((a, b) => a.number - b.number);
      rows.push({
        pr,
        depth,
        rails,
        last,
        hasChildren: kids.length > 0,
        orphan: depth === 0 && pr.base !== pr.defaultBranch && !allHeads.has(pr.base),
      });
      const childRails = depth === 0 ? [] : [...rails, !last];
      kids.forEach((kid, i) => walk(kid, depth + 1, childRails, i === kids.length - 1));
    };
    walk(root, 0, [], true);
    return { rows, activeAt: newest(rows.map((r) => r.pr)) };
  });
  return stacks.sort((a, b) => b.activeAt.localeCompare(a.activeAt));
}

export function newest(prs: PullRequest[]): string {
  return prs.reduce((max, p) => (p.activeAt > max ? p.activeAt : max), '');
}
