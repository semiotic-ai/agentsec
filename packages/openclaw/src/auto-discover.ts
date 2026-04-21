/**
 * Multi-platform auto-discover -- unions the default skill search paths
 * from every supported agent platform (Claude Code, OpenClaw/ClawHub,
 * Codex/skills.sh) and scans each one for installed skills.
 *
 * This module is resilient to missing platform-default modules: it
 * probes for optional `@agentsec/shared` submodules via try/catch
 * dynamic imports, and falls back to an inline list of known paths
 * when none are available.
 */

import { readdir } from "node:fs/promises";
import { homedir, platform as osPlatform } from "node:os";
import { join, resolve } from "node:path";
import type { AgentSkill } from "@agentsec/shared";
import { OPENCLAW_SKILL_DIRS } from "@agentsec/shared";
import { SkillDiscovery } from "./discovery";

/** Options accepted by {@link discoverAll}. */
export interface DiscoverAllOptions {
  /** Extra roots to scan in addition to the cross-platform defaults. */
  additionalPaths?: string[];
  /** If true, skip reading file contents for discovered skills. */
  shallow?: boolean;
  /** Override OS platform detection (useful for tests). */
  platform?: string;
}

/**
 * Inline fallback list of default skill directories, used when the
 * dedicated per-platform modules under `@agentsec/shared/defaults/*`
 * have not been landed yet. Keeps auto-discovery useful in a fresh
 * worktree.
 */
const FALLBACK_DIRS: Record<string, string[]> = {
  darwin: [
    "~/.claude/skills",
    ".claude/skills",
    "~/.claude/commands",
    ".claude/commands",
    "~/.claude/plugins/*/skills/*",
    "~/.openclaw/workspace/skills",
    "~/.openclaw/workspace-*/skills",
    "~/.openclaw/skills",
    "~/.agents/skills",
    "./.agents/skills",
    "./skills",
  ],
  linux: [
    "~/.claude/skills",
    ".claude/skills",
    "~/.claude/commands",
    ".claude/commands",
    "~/.claude/plugins/*/skills/*",
    "~/.openclaw/workspace/skills",
    "~/.openclaw/workspace-*/skills",
    "~/.openclaw/skills",
    "~/.agents/skills",
    "./.agents/skills",
    "./skills",
  ],
  win32: [
    "%APPDATA%/claude/skills",
    "%LOCALAPPDATA%/claude/skills",
    ".\\.claude\\skills",
    ".\\.claude\\commands",
    "%APPDATA%/openclaw/skills",
    "%LOCALAPPDATA%/openclaw/skills",
    "%APPDATA%/openclaw/workspace/skills",
    ".\\.agents\\skills",
    ".\\skills",
  ],
};

/**
 * Dynamic import wrapper -- tries to load a module export by specifier,
 * returning `undefined` if the module or symbol is missing. The
 * specifier is passed through a variable so TypeScript does not
 * attempt to type-resolve modules that may not exist yet (Units 1-5
 * are in-flight in parallel).
 */
async function tryDynamicImport(specifier: string): Promise<Record<string, unknown> | undefined> {
  try {
    // Assign to a variable first to defeat TypeScript's static module
    // resolution on the string literal. The runtime loader resolves
    // it normally; missing modules fall through to the catch.
    const dynamicSpecifier: string = specifier;
    return (await import(dynamicSpecifier)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Try to load a per-platform skill-dirs map (e.g. `CLAUDE_SKILL_DIRS`)
 * from one of the shared submodules emitted by Units 1-3.
 */
async function tryImportDirs(
  specifier: string,
  exportName: string,
): Promise<Record<string, string[]> | undefined> {
  const mod = await tryDynamicImport(specifier);
  if (!mod) return undefined;
  const value = mod[exportName];
  if (value && typeof value === "object") {
    return value as Record<string, string[]>;
  }
  return undefined;
}

/**
 * Try to load the `inferPlatformFromPath` helper from Unit 5.
 * Returns `null` if unavailable.
 */
async function tryImportInferPlatform(): Promise<((path: string) => string | null) | null> {
  const mod = await tryDynamicImport("@agentsec/shared/platform-detect");
  const fn = mod?.inferPlatformFromPath;
  return typeof fn === "function" ? (fn as (path: string) => string | null) : null;
}

/**
 * Try to load `expandDefaultPath` from Unit 4. If unavailable we use
 * an inline expander that handles `~` and env vars but not globs.
 */
async function tryImportExpandDefaultPath(): Promise<
  ((pattern: string) => Promise<string[]>) | null
> {
  const mod = await tryDynamicImport("@agentsec/shared/paths/expand");
  const fn = mod?.expandDefaultPath;
  return typeof fn === "function" ? (fn as (pattern: string) => Promise<string[]>) : null;
}

/**
 * Resolve the effective home directory, preferring `$HOME` when it is
 * set. This lets tests monkey-patch `process.env.HOME` to redirect
 * discovery at a fixture tree (since `os.homedir()` reads directly
 * from the OS user database and ignores env vars).
 */
function effectiveHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? homedir();
}

/**
 * Inline path expansion covering `~` and `%VAR%` tokens. Glob `*`
 * patterns are resolved by listing matching subdirectories one segment
 * at a time. Returns an empty array when a segment cannot be read.
 */
async function inlineExpand(pattern: string): Promise<string[]> {
  let expanded = pattern;

  if (expanded.startsWith("~/") || expanded === "~") {
    expanded = join(effectiveHome(), expanded.slice(1));
  }

  expanded = expanded.replace(/%([^%]+)%/g, (_, name: string) => {
    return process.env[name] ?? `%${name}%`;
  });

  if (!expanded.includes("*")) {
    return [resolve(expanded)];
  }

  // Glob expansion: walk segments, branching on any segment that
  // contains a `*`. We stop at the first unreadable directory.
  const segments = expanded.split("/");
  let candidates: string[] = [segments[0] === "" ? "/" : (segments[0] ?? "")];

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (segment === undefined || segment === "") continue;

    const next: string[] = [];
    for (const base of candidates) {
      if (!segment.includes("*")) {
        next.push(join(base, segment));
        continue;
      }
      const matcher = globSegmentMatcher(segment);
      try {
        const entries = await readdir(base, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (matcher.test(entry.name)) {
            next.push(join(base, entry.name));
          }
        }
      } catch {
        // Unreadable -- skip this branch.
      }
    }
    candidates = next;
  }

  return candidates.map((p) => resolve(p));
}

/** Build a regex that matches a single path segment glob (no slashes). */
function globSegmentMatcher(segment: string): RegExp {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

/** Best-effort platform inference for when Unit 5 hasn't landed. */
function inferPlatformFallback(rootPath: string): string | null {
  const lower = rootPath.toLowerCase();
  if (/(^|[/\\])\.claude([/\\]|$)/.test(lower)) return "claude";
  if (/(^|[/\\])\.openclaw([/\\]|$)/.test(lower)) return "openclaw";
  if (/(^|[/\\])\.agents([/\\]|$)/.test(lower)) return "codex";
  return null;
}

/**
 * Gather all per-OS path patterns from every available source
 * (Unit 1-3 shared modules, legacy {@link OPENCLAW_SKILL_DIRS}, and
 * the inline {@link FALLBACK_DIRS}). Later sources are unioned onto
 * earlier ones, with de-duplication preserving first-seen order.
 */
async function collectPatterns(platformKey: string, extraPaths: string[]): Promise<string[]> {
  const [claude, openclawV2, codex] = await Promise.all([
    tryImportDirs("@agentsec/shared/defaults/claude", "CLAUDE_SKILL_DIRS"),
    tryImportDirs("@agentsec/shared/defaults/openclaw", "OPENCLAW_SKILL_DIRS_V2"),
    tryImportDirs("@agentsec/shared/defaults/codex", "CODEX_SKILL_DIRS"),
  ]);

  const sources: Record<string, string[]>[] = [];
  if (claude) sources.push(claude);
  if (openclawV2) sources.push(openclawV2);
  if (codex) sources.push(codex);
  sources.push(OPENCLAW_SKILL_DIRS);
  sources.push(FALLBACK_DIRS);

  const seen = new Set<string>();
  const patterns: string[] = [];

  for (const source of sources) {
    for (const pattern of source[platformKey] ?? []) {
      if (seen.has(pattern)) continue;
      seen.add(pattern);
      patterns.push(pattern);
    }
  }

  for (const extra of extraPaths) {
    if (seen.has(extra)) continue;
    seen.add(extra);
    patterns.push(extra);
  }

  return patterns;
}

/**
 * Discover installed skills across ALL supported agent platforms in
 * one sweep.
 *
 * Unions the platform-specific default search paths (Claude Code,
 * OpenClaw/ClawHub, Codex/skills.sh), expands `~`, env vars, and `*`
 * globs, then scans each resolved directory for skills. Skills are
 * deduplicated by absolute path and tagged with `sourceRoot` +
 * `discoveredAs` when the host `AgentSkill` type supports those fields.
 *
 * @param options - discovery options; see {@link DiscoverAllOptions}
 * @returns merged, deduplicated list of skills across every platform root
 */
export async function discoverAll(options: DiscoverAllOptions = {}): Promise<AgentSkill[]> {
  const platformKey = options.platform ?? osPlatform();

  const [patterns, expander, inferPlatform] = await Promise.all([
    collectPatterns(platformKey, options.additionalPaths ?? []),
    tryImportExpandDefaultPath().then((fn) => fn ?? inlineExpand),
    tryImportInferPlatform().then((fn) => fn ?? inferPlatformFallback),
  ]);

  // Expand each pattern in parallel. One pattern can yield many
  // concrete paths (e.g. a `workspace-*` glob); we carry the original
  // sourceRoot through so we can tag discovered skills later.
  const expansions = await Promise.all(
    patterns.map(async (pattern) => {
      try {
        const resolvedPaths = await expander(pattern);
        return { pattern, resolvedPaths };
      } catch {
        return { pattern, resolvedPaths: [] as string[] };
      }
    }),
  );

  const expandedPaths: { absolutePath: string; sourceRoot: string }[] = [];
  const seenExpanded = new Set<string>();
  for (const { pattern, resolvedPaths } of expansions) {
    for (const absolutePath of resolvedPaths) {
      if (seenExpanded.has(absolutePath)) continue;
      seenExpanded.add(absolutePath);
      expandedPaths.push({ absolutePath, sourceRoot: pattern });
    }
  }

  // Scan every resolved root concurrently.
  const discovery = new SkillDiscovery({ shallow: options.shallow });
  const scanResults = await Promise.all(
    expandedPaths.map(async ({ absolutePath, sourceRoot }) => ({
      sourceRoot,
      discoveredAs: inferPlatform(sourceRoot),
      skills: await discovery.scanDirectory(absolutePath),
    })),
  );

  const skills: AgentSkill[] = [];
  const seenSkillPaths = new Set<string>();
  for (const { sourceRoot, discoveredAs, skills: discovered } of scanResults) {
    for (const skill of discovered) {
      if (seenSkillPaths.has(skill.path)) continue;
      seenSkillPaths.add(skill.path);

      // Trust a sourceRoot already attached by the parser (Unit 6) if
      // present; otherwise tag with the root that produced this scan.
      const existingSourceRoot = (skill as AgentSkill & { sourceRoot?: string }).sourceRoot;

      // TODO: drop the cast once `sourceRoot`/`discoveredAs` are
      // first-class fields on `AgentSkill` (Unit 6).
      skills.push({
        ...skill,
        sourceRoot: existingSourceRoot ?? sourceRoot,
        ...(discoveredAs ? { discoveredAs } : {}),
      } as AgentSkill);
    }
  }

  return skills;
}
