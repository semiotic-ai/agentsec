/**
 * Default skill discovery paths for OpenAI Codex and skills.sh.
 *
 * Codex documents these locations at https://developers.openai.com/codex/skills
 * (Discovery Paths). The `~/.agents/skills` path is also the agent-agnostic
 * install location used by skills.sh (https://skills.sh/docs), so this
 * constant doubles as the skills.sh default list.
 *
 * Keys correspond to `process.platform` values (`darwin`, `linux`, `win32`).
 *
 * @example
 * ```ts
 * import { CODEX_SKILL_DIRS } from "@agentsec/shared";
 * const dirs = CODEX_SKILL_DIRS[process.platform] ?? [];
 * ```
 */
export const CODEX_SKILL_DIRS: Record<string, string[]> = {
  darwin: ["~/.agents/skills", "./.agents/skills", "../.agents/skills", "/etc/codex/skills"],
  linux: ["~/.agents/skills", "./.agents/skills", "../.agents/skills", "/etc/codex/skills"],
  win32: [
    "%USERPROFILE%/.agents/skills",
    ".\\.agents\\skills",
    "..\\.agents\\skills",
    "%PROGRAMDATA%/codex/skills",
  ],
};
