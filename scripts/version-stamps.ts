/**
 * Single source of truth for every place a version number is stamped in the
 * repository. Both `bump-version.ts` and `check-versions.ts` read this list.
 *
 * Adding a new stamp = add one entry here. Removing a stamp = remove it here.
 *
 * The canonical version lives in `packages/cli/package.json`. `CANONICAL_FILE`
 * is what `check-versions.ts` reads to learn "what is the current version?"
 * and what `bump-version.ts` would diff against if no `--from` is provided.
 */

export const CANONICAL_FILE = "packages/cli/package.json";

/**
 * SKILL.md is duplicated into the landing site's public dir so the website
 * (and ClawHub, which fetches from the landing site / GitHub raw) sees the
 * same skill manifest. Keep these byte-identical.
 */
export const SKILL_MIRROR = {
  source: "skills/agentsec/SKILL.md",
  mirror: "apps/landing/public/skill.md",
} as const;

export type VersionStamp = {
  /** Repo-relative file path. */
  file: string;
  /** Why this file has the version (for human-readable output). */
  description: string;
  /**
   * The exact substring to find in the file, with `{VERSION}` as a placeholder
   * for the semver string. Must be unique within the file (the scripts assert
   * this). Surround with enough context to guarantee uniqueness — e.g. include
   * trailing characters like `"\nhomepage:"` if `version:` could appear more
   * than once.
   */
  pattern: string;
};

export const STAMPS: VersionStamp[] = [
  {
    file: "packages/cli/package.json",
    description: "Published npm CLI version (canonical)",
    pattern: '"version": "{VERSION}"',
  },
  {
    file: "packages/shared/src/constants.ts",
    description: "AUDIT_VERSION runtime constant (used by --version, SARIF driver)",
    pattern: 'export const AUDIT_VERSION = "{VERSION}";',
  },
  {
    file: SKILL_MIRROR.source,
    description: "GitHub-canonical SKILL.md frontmatter",
    pattern: "\nversion: {VERSION}\nhomepage:",
  },
  {
    file: SKILL_MIRROR.mirror,
    description: "Landing site mirror of SKILL.md (served at /skill.md, indexed by ClawHub)",
    pattern: "\nversion: {VERSION}\nhomepage:",
  },
  {
    file: "apps/landing/components/Hero.tsx",
    description: "Landing hero version chip",
    pattern: "v{VERSION} · MIT",
  },
  {
    file: "apps/landing/components/Header.tsx",
    description: "Landing header version pill",
    pattern: "            v{VERSION}\n          </span>",
  },
  {
    file: "apps/landing/components/Footer.tsx",
    description: "Landing footer version chip",
    pattern: "v{VERSION} · <span",
  },
];

export function fillPattern(pattern: string, version: string): string {
  return pattern.replaceAll("{VERSION}", version);
}

/** Returns the canonical version (i.e. what every other stamp should match). */
export async function readCanonicalVersion(repoRoot: string): Promise<string> {
  const path = `${repoRoot}/${CANONICAL_FILE}`;
  const text = await Bun.file(path).text();
  const match = text.match(/"version":\s*"([^"]+)"/);
  if (!match) {
    throw new Error(`Could not find version field in ${CANONICAL_FILE}`);
  }
  return match[1];
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/;

export function assertSemver(version: string): void {
  if (!SEMVER.test(version)) {
    throw new Error(`Not a valid semver: "${version}" (expected e.g. 0.1.6)`);
  }
}

export function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .split("-")[0]
      .split(".")
      .map((n) => Number.parseInt(n, 10));
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}
