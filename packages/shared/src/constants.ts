import type { AgentPlatform } from "./types";

export const OPENCLAW_SKILL_DIRS: Record<string, string[]> = {
  darwin: [
    "~/.openclaw/skills",
    "~/.config/openclaw/skills",
    "~/Library/Application Support/openclaw/skills",
  ],
  linux: [
    "~/.openclaw/skills",
    "~/.config/openclaw/skills",
  ],
  win32: [
    "%APPDATA%/openclaw/skills",
    "%LOCALAPPDATA%/openclaw/skills",
  ],
};

export const CLAUDE_SKILL_DIRS: Record<string, string[]> = {
  darwin: [
    "~/.claude/commands",
    ".claude/commands",
  ],
};

export const SKILL_MANIFEST_FILES = [
  "skill.json",
  "skill.yaml",
  "skill.yml",
  "SKILL.md",
  "package.json",
  "manifest.json",
];

export const DANGEROUS_PERMISSIONS = [
  "filesystem:write",
  "network:unrestricted",
  "shell:execute",
  "env:read",
  "credentials:access",
  "system:admin",
  "browser:navigate",
  "clipboard:read",
  "clipboard:write",
];

export const SUPPORTED_PLATFORMS: AgentPlatform[] = [
  "openclaw",
  "claude",
  "codex",
];

export const AUDIT_VERSION = "0.1.0";
