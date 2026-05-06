/**
 * Default skill directories for Claude Code.
 *
 * Keyed by `process.platform` (`darwin`, `linux`, `win32`). Paths are expressed
 * in template form: `~` denotes the user's home directory, `%USERPROFILE%`
 * denotes the Windows user profile, and `*` denotes a glob segment. Path
 * expansion (home/env-var substitution and glob matching) is performed
 * elsewhere by a dedicated utility — this module only enumerates the known
 * default locations.
 *
 * Each entry represents one of four tiers:
 * - **personal**: user-scoped skills under `~/.claude/skills`.
 * - **project**: repo-scoped skills under `.claude/skills`.
 * - **legacy**: older `commands` directories retained for backward compatibility
 *   (`~/.claude/commands`, `.claude/commands`).
 * - **plugin**: skills bundled inside installed plugins
 *   (`~/.claude/plugins/<plugin>/skills/<skill>`).
 *
 * @remarks Darwin and Linux share the same layout; Windows uses
 * `%USERPROFILE%` and backslash-separated project paths.
 *
 * This is the v2 export. The legacy `CLAUDE_SKILL_DIRS` in `../constants.ts`
 * is retained until all consumers migrate.
 */
const POSIX_CLAUDE_SKILL_DIRS = [
  "~/.claude/skills",
  ".claude/skills",
  "~/.claude/commands",
  ".claude/commands",
  "~/.claude/plugins/*/skills/*",
];

export const CLAUDE_SKILL_DIRS_V2: Record<string, string[]> = {
  darwin: POSIX_CLAUDE_SKILL_DIRS,
  linux: POSIX_CLAUDE_SKILL_DIRS,
  win32: [
    "%USERPROFILE%/.claude/skills",
    ".claude\\skills",
    "%USERPROFILE%/.claude/commands",
    ".claude\\commands",
    "%USERPROFILE%/.claude/plugins/*/skills/*",
  ],
};
