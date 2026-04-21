/**
 * Multi-platform auto-discover — unions the default skill search paths
 * from every supported agent platform (Claude Code, OpenClaw/ClawHub,
 * Codex/skills.sh), resolves `~` / env vars / `*` globs, and also walks
 * the current working directory looking for generic `skills/` folders
 * that don't live under a recognized platform path.
 */

import { readdir } from "node:fs/promises";
import { homedir, platform as osPlatform } from "node:os";
import { join } from "node:path";
import type { AgentSkill } from "@agentsec/shared";
import {
  CLAUDE_SKILL_DIRS_V2,
  CODEX_SKILL_DIRS,
  expandDefaultPath,
  inferPlatformFromPath,
  OPENCLAW_SKILL_DIRS_V2,
} from "@agentsec/shared";
import { SkillDiscovery } from "./discovery";

/**
 * Home directory used to expand leading `~` in default-path patterns.
 * Prefers `$HOME` / `$USERPROFILE` when set so tests can sandbox discovery
 * by monkey-patching the env (node's `os.homedir()` bypasses env vars on
 * macOS, consulting the password database instead).
 */
function effectiveHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? homedir();
}

/**
 * Substitute a leading `~` with the effective home directory. Any other
 * expansion (env vars, globs) is left to {@link expandDefaultPath}.
 */
function preExpandTilde(pattern: string): string {
  if (pattern === "~") return effectiveHome();
  if (pattern.startsWith("~/") || pattern.startsWith("~\\")) {
    return join(effectiveHome(), pattern.slice(2));
  }
  return pattern;
}

/** Options accepted by {@link discoverAll}. */
export interface DiscoverAllOptions {
  /** Extra roots to scan in addition to the cross-platform defaults. */
  additionalPaths?: string[];
  /** If true, skip reading file contents for discovered skills. */
  shallow?: boolean;
  /** Override OS platform detection (useful for tests). */
  platform?: string;
  /**
   * Root to walk looking for generic `skills/` directories that are not
   * under a recognized platform path. Defaults to `process.cwd()`.
   * Pass `null` to disable cwd walking entirely.
   */
  cwd?: string | null;
  /**
   * Maximum directory depth to walk from cwd when looking for generic
   * `skills/` dirs. `0` = cwd only. Default: `2`.
   */
  cwdDepth?: number;
}

/**
 * Directories skipped when walking the cwd. These are large/irrelevant
 * for skill discovery and walking into them wastes time.
 */
const CWD_IGNORE = new Set([
  "node_modules",
  ".git",
  ".turbo",
  ".next",
  ".cache",
  "dist",
  "build",
  "out",
  "coverage",
  "target",
  "vendor",
  ".venv",
  "__pycache__",
]);

/**
 * Hidden dirs that ARE meaningful for skill discovery (i.e. platform
 * conventions). Other hidden dirs are skipped during cwd walking.
 */
const CWD_ALLOWED_HIDDEN = new Set([".claude", ".openclaw", ".agents", ".codex"]);

/**
 * Walk `cwd` up to `depth` levels deep and collect every directory named
 * `skills` that contains at least one skill-like child. This catches the
 * common case of a project repo whose skills live at `./skills/` without
 * a `.claude/` or `.openclaw/` marker.
 */
async function findLocalSkillsDirs(cwd: string, depth: number): Promise<string[]> {
  const found = new Set<string>();

  async function walk(dir: string, remaining: number): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = (await readdir(dir, { withFileTypes: true })) as import("node:fs").Dirent[];
    } catch {
      return;
    }

    const descend: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;

      if (name === "skills") {
        found.add(join(dir, name));
        continue;
      }

      if (CWD_IGNORE.has(name)) continue;
      if (name.startsWith(".") && !CWD_ALLOWED_HIDDEN.has(name)) continue;

      if (remaining > 0) descend.push(join(dir, name));
    }

    await Promise.all(descend.map((d) => walk(d, remaining - 1)));
  }

  await walk(cwd, depth);
  return [...found];
}

/**
 * Union every per-platform default path list for this OS, then append
 * any caller-provided extras. Preserves first-seen order for
 * predictable display.
 */
function collectPatterns(platformKey: string, extra: string[]): string[] {
  const sources = [CLAUDE_SKILL_DIRS_V2, OPENCLAW_SKILL_DIRS_V2, CODEX_SKILL_DIRS];
  const seen = new Set<string>();
  const patterns: string[] = [];
  for (const src of sources) {
    for (const p of src[platformKey] ?? []) {
      if (!seen.has(p)) {
        seen.add(p);
        patterns.push(p);
      }
    }
  }
  for (const p of extra) {
    if (!seen.has(p)) {
      seen.add(p);
      patterns.push(p);
    }
  }
  return patterns;
}

/**
 * Discover installed skills across ALL supported agent platforms in
 * one sweep. Unions the platform-specific default search paths (Claude
 * Code, OpenClaw/ClawHub, Codex/skills.sh), walks the cwd for generic
 * `skills/` dirs, expands `~` / env vars / `*` globs, scans each
 * resolved directory, and deduplicates skills by absolute path.
 *
 * @param options - discovery options; see {@link DiscoverAllOptions}
 * @returns merged, deduplicated list of skills across every root
 */
export async function discoverAll(options: DiscoverAllOptions = {}): Promise<AgentSkill[]> {
  const platformKey = options.platform ?? osPlatform();
  const extra = [...(options.additionalPaths ?? [])];

  const cwdRoot = options.cwd === null ? null : (options.cwd ?? process.cwd());
  if (cwdRoot !== null) {
    const depth = options.cwdDepth ?? 2;
    const localDirs = await findLocalSkillsDirs(cwdRoot, depth);
    extra.push(...localDirs);
  }

  const patterns = collectPatterns(platformKey, extra);

  const expansions = await Promise.all(
    patterns.map(async (pattern) => {
      try {
        const resolved = await expandDefaultPath(preExpandTilde(pattern));
        return { pattern, resolved };
      } catch {
        return { pattern, resolved: [] as string[] };
      }
    }),
  );

  const expandedRoots: { absolutePath: string; sourceRoot: string }[] = [];
  const seenRoots = new Set<string>();
  for (const { pattern, resolved } of expansions) {
    for (const absolutePath of resolved) {
      if (seenRoots.has(absolutePath)) continue;
      seenRoots.add(absolutePath);
      expandedRoots.push({ absolutePath, sourceRoot: pattern });
    }
  }

  const discovery = new SkillDiscovery({ shallow: options.shallow });
  const scanResults = await Promise.all(
    expandedRoots.map(async ({ absolutePath, sourceRoot }) => ({
      sourceRoot,
      discoveredAs: inferPlatformFromPath(absolutePath) ?? undefined,
      skills: await discovery.scanDirectory(absolutePath),
    })),
  );

  const skills: AgentSkill[] = [];
  const seenSkillPaths = new Set<string>();
  for (const { sourceRoot, discoveredAs, skills: discovered } of scanResults) {
    for (const skill of discovered) {
      if (seenSkillPaths.has(skill.path)) continue;
      seenSkillPaths.add(skill.path);
      skills.push({
        ...skill,
        sourceRoot: skill.sourceRoot ?? sourceRoot,
        discoveredAs: skill.discoveredAs ?? discoveredAs,
      });
    }
  }
  return skills;
}
