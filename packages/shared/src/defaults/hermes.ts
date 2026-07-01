/**
 * Default skill discovery paths for Hermes Agent (Nous Research).
 *
 * Hermes follows the agentskills.io SKILL.md specification — the same
 * format consumed by Claude Code, OpenClaw, and Codex. Its skill
 * hierarchy resolves to `~/.hermes/skills/` (cross-platform). Hermes-
 * namespaced manifest extensions live under `metadata.hermes.*`
 * (tags, category, requires_toolsets, fallback_for_toolsets,
 * requires_tools, fallback_for_tools, config). See
 * https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
 * for the canonical specification.
 *
 * Hermes also supports a configurable `skills.external_dirs` list in
 * `~/.hermes/config.yaml`; resolving those is the job of a higher-level
 * config-aware loader. This module only enumerates the platform
 * defaults — pre-seeded bundles under `<category>/` plus the user's
 * personal skills directory.
 *
 * Keyed by `process.platform` values (`darwin`, `linux`, `win32`).
 */
export const HERMES_SKILL_DIRS: Record<string, string[]> = {
  darwin: ["~/.hermes/skills", "~/.hermes/skills/*", "./.hermes/skills"],
  linux: ["~/.hermes/skills", "~/.hermes/skills/*", "./.hermes/skills"],
  win32: ["%USERPROFILE%/.hermes/skills", "%USERPROFILE%/.hermes/skills/*", ".\\.hermes\\skills"],
};
