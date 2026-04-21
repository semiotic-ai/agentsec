import type { AgentPlatform } from "../types";

/**
 * Infer which agent platform a skill belongs to, based on substrings
 * in its absolute directory path. Returns `null` when no confident match.
 *
 * Priority order (first match wins; evaluated top-down):
 *   1. `"claude"`   - any of `/.claude/skills`, `/.claude/commands`, `/.claude/plugins/`
 *   2. `"openclaw"` - any occurrence of `/.openclaw/`
 *   3. `"codex"`    - any of `/.agents/skills`, `/.codex/`, `/etc/codex/`
 *
 * Normalizes Windows backslashes to forward slashes before matching so the
 * same implementation works on every OS.
 *
 * @param absPath Absolute filesystem path to a skill directory.
 * @returns The inferred {@link AgentPlatform}, or `null` when no confident match.
 */
export function inferPlatformFromPath(absPath: string): AgentPlatform | null {
  if (!absPath) return null;

  const normalized = absPath.replace(/\\/g, "/");

  if (
    normalized.includes("/.claude/skills") ||
    normalized.includes("/.claude/commands") ||
    normalized.includes("/.claude/plugins/")
  ) {
    return "claude";
  }

  if (normalized.includes("/.openclaw/")) {
    return "openclaw";
  }

  if (
    normalized.includes("/.agents/skills") ||
    normalized.includes("/.codex/") ||
    normalized.includes("/etc/codex/")
  ) {
    return "codex";
  }

  return null;
}
