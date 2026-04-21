/**
 * Default skill discovery paths for OpenClaw workspaces.
 *
 * OpenClaw's skill hierarchy (per the OpenClaw docs) resolves skills in this order:
 *   workspace-specific > managed (`~/.openclaw/skills/`) > bundled
 *
 * The `OPENCLAW_PROFILE` environment variable redirects the active workspace
 * path from `~/.openclaw/workspace` to `~/.openclaw/workspace-<profile>` when
 * set to any value other than `"default"`. The glob variant (`workspace-*`)
 * is included so discovery catches every named profile without enumerating
 * them; resolving the glob is the job of a separate path-expansion utility.
 */

/**
 * Per-platform list of default locations where OpenClaw skills may live.
 *
 * Keyed by Node's `process.platform` values (`darwin`, `linux`, `win32`).
 * darwin and linux share the same POSIX-style paths; win32 uses the Windows
 * `%USERPROFILE%`, `%APPDATA%`, and `%LOCALAPPDATA%` environment variables.
 *
 * Paths starting with `~` or an env-var reference must be expanded by the
 * caller before use on the filesystem.
 */
export const OPENCLAW_SKILL_DIRS_V2: Record<string, string[]> = {
  darwin: [
    "~/.openclaw/workspace/skills",
    "~/.openclaw/workspace-*/skills",
    "~/.openclaw/skills",
    "./skills",
    "./.agents/skills",
  ],
  linux: [
    "~/.openclaw/workspace/skills",
    "~/.openclaw/workspace-*/skills",
    "~/.openclaw/skills",
    "./skills",
    "./.agents/skills",
  ],
  win32: [
    "%USERPROFILE%/.openclaw/workspace/skills",
    "%USERPROFILE%/.openclaw/workspace-*/skills",
    "%USERPROFILE%/.openclaw/skills",
    "%APPDATA%/openclaw/skills",
    "%LOCALAPPDATA%/openclaw/skills",
    ".\\skills",
    ".\\.agents\\skills",
  ],
};

/**
 * Resolve the concrete workspace directory for a given OpenClaw profile.
 *
 * If `profile` is omitted, the `OPENCLAW_PROFILE` environment variable is
 * consulted, defaulting to `"default"` when unset. The literal profile name
 * `"default"` maps to `~/.openclaw/workspace`; any other value maps to
 * `~/.openclaw/workspace-<profile>`.
 *
 * The returned path is left unexpanded (still contains `~`); callers are
 * expected to run it through their home-dir expansion utility.
 *
 * @param profile - Optional profile name. Falls back to `OPENCLAW_PROFILE`
 *                  env var, then to `"default"`.
 * @returns The workspace directory path for the resolved profile.
 */
export function getOpenclawWorkspaceDir(profile?: string): string {
  const p = profile ?? process.env.OPENCLAW_PROFILE ?? "default";
  return p === "default" ? "~/.openclaw/workspace" : `~/.openclaw/workspace-${p}`;
}
