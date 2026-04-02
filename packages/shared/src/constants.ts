import type { AgentPlatform } from "./types";

export const OPENCLAW_SKILL_DIRS: Record<string, string[]> = {
  darwin: [
    "~/.openclaw/skills",
    "~/.agents/skills",
    "./skills",
    "./.agents/skills",
  ],
  linux: [
    "~/.openclaw/skills",
    "~/.agents/skills",
    "./skills",
    "./.agents/skills",
  ],
  win32: [
    "%APPDATA%/openclaw/skills",
    "%LOCALAPPDATA%/openclaw/skills",
    ".\\skills",
    ".\\.agents\\skills",
  ],
};

/** OpenClaw config file paths for reading installed skill state */
export const OPENCLAW_CONFIG_FILES = {
  mainConfig: "~/.openclaw/openclaw.json",
  clawHubConfig: "~/Library/Application Support/clawhub/config.json",
  lockFile: ".clawhub/lock.json",
  originFile: ".clawhub/origin.json",
};

export const CLAUDE_SKILL_DIRS: Record<string, string[]> = {
  darwin: [
    "~/.claude/commands",
    ".claude/commands",
  ],
};

export const SKILL_MANIFEST_FILES = [
  "SKILL.md",       // Primary format for OpenClaw/ClawHub skills
  "skill.json",
  "skill.yaml",
  "skill.yml",
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
