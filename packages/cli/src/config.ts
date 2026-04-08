/**
 * Configuration loader for agent-audit.
 *
 * Searches for .agentauditrc or agent-audit.config.json in cwd
 * and parent directories, then merges with CLI flags.
 */

import { join, resolve } from "node:path";
import type { AgentPlatform, OutputFormat } from "@agent-audit/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CliFlags {
  command: string;
  format: OutputFormat;
  output: string | null;
  policy: string | null;
  platform: AgentPlatform;
  path: string | null;
  verbose: boolean;
  noColor: boolean;
  help: boolean;
  version: boolean;
  /** Positional args after the command */
  args: string[];
}

export interface AuditConfig {
  /** Output format */
  format: OutputFormat;
  /** Path to write report file */
  output: string | null;
  /** Policy preset name or path to config file */
  policy: string | null;
  /** Agent platform to target */
  platform: AgentPlatform;
  /** Custom skill directory to scan */
  path: string | null;
  /** Enable verbose logging */
  verbose: boolean;
}

// ---------------------------------------------------------------------------
// Config file search
// ---------------------------------------------------------------------------

const CONFIG_FILENAMES = [".agentauditrc", ".agentauditrc.json", "agent-audit.config.json"];

async function findConfigFile(startDir: string): Promise<string | null> {
  let dir = resolve(startDir);

  // Walk up the directory tree
  for (let i = 0; i < 10; i++) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = join(dir, name);
      const file = Bun.file(candidate);
      if (await file.exists()) {
        return candidate;
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return null;
}

export async function loadConfigFile(
  startDir: string = process.cwd(),
): Promise<Partial<AuditConfig>> {
  const configPath = await findConfigFile(startDir);
  if (!configPath) return {};

  try {
    const file = Bun.file(configPath);
    const text = await file.text();
    const parsed = JSON.parse(text);

    return {
      format: parsed.format,
      output: parsed.output,
      policy: parsed.policy,
      platform: parsed.platform,
      path: parsed.path,
      verbose: parsed.verbose,
    };
  } catch {
    // Silently ignore broken config files; the CLI flags will take effect.
    return {};
  }
}

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

const VALID_FORMATS = new Set(["text", "json", "sarif", "html"]);
const VALID_PLATFORMS = new Set(["openclaw", "claude", "codex"]);
const VALID_COMMANDS = new Set(["audit", "scan", "report", "policy", "version", "help"]);

/** Flags that consume the next arg as a value. Returns the number of args consumed (0 or 1). */
function applyValueFlag(flags: CliFlags, arg: string, nextArg: string | undefined): number {
  switch (arg) {
    case "--format":
    case "-f":
      if (nextArg && VALID_FORMATS.has(nextArg)) flags.format = nextArg as OutputFormat;
      return 1;
    case "--output":
    case "-o":
      flags.output = nextArg ?? null;
      return 1;
    case "--policy":
    case "-p":
      flags.policy = nextArg ?? null;
      return 1;
    case "--platform":
      if (nextArg && VALID_PLATFORMS.has(nextArg)) flags.platform = nextArg as AgentPlatform;
      return 1;
    case "--path":
      flags.path = nextArg ?? null;
      return 1;
    default:
      return 0;
  }
}

/** Boolean flags that don't consume an extra arg. Returns true if matched. */
function applyBooleanFlag(flags: CliFlags, arg: string): boolean {
  switch (arg) {
    case "--verbose":
    case "-v":
      flags.verbose = true;
      return true;
    case "--no-color":
      flags.noColor = true;
      return true;
    case "--help":
    case "-h":
      flags.help = true;
      return true;
    case "--version":
    case "-V":
      flags.version = true;
      return true;
    default:
      return false;
  }
}

export function parseFlags(argv: string[]): CliFlags {
  // Bun.argv: [bunPath, scriptPath, ...userArgs]
  const args = argv.slice(2);

  const flags: CliFlags = {
    command: "audit",
    format: "text",
    output: null,
    policy: null,
    platform: "openclaw",
    path: null,
    verbose: false,
    noColor: false,
    help: false,
    version: false,
    args: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    const consumed = applyValueFlag(flags, arg, args[i + 1]);
    if (consumed) {
      i += 1 + consumed;
      continue;
    }

    if (applyBooleanFlag(flags, arg)) {
      i++;
      continue;
    }

    // Positional args
    if (!arg.startsWith("-")) {
      if (flags.command === "audit" && i === 0 && VALID_COMMANDS.has(arg)) {
        flags.command = arg;
      } else {
        flags.args.push(arg);
      }
    }

    i++;
  }

  // --help and --version override command
  if (flags.version) flags.command = "version";
  if (flags.help && flags.command === "audit") flags.command = "help";

  return flags;
}

// ---------------------------------------------------------------------------
// Merge config file + CLI flags
// ---------------------------------------------------------------------------

export async function resolveConfig(flags: CliFlags): Promise<AuditConfig> {
  const fileConfig = await loadConfigFile();

  return {
    format: flags.format !== "text" ? flags.format : (fileConfig.format ?? "text"),
    output: flags.output ?? fileConfig.output ?? null,
    policy: flags.policy ?? fileConfig.policy ?? null,
    platform: flags.platform !== "openclaw" ? flags.platform : (fileConfig.platform ?? "openclaw"),
    path: flags.path ?? fileConfig.path ?? null,
    verbose: flags.verbose || fileConfig.verbose || false,
  };
}
