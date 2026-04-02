/**
 * Configuration loader for agent-audit.
 *
 * Searches for .agentauditrc or agent-audit.config.json in cwd
 * and parent directories, then merges with CLI flags.
 */

import { resolve, join } from "path";
import type { AgentPlatform, OutputFormat, PolicyConfig } from "@agent-audit/shared";

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

const CONFIG_FILENAMES = [
  ".agentauditrc",
  ".agentauditrc.json",
  "agent-audit.config.json",
];

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

export async function loadConfigFile(startDir: string = process.cwd()): Promise<Partial<AuditConfig>> {
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

    // Named flags
    if (arg === "--format" || arg === "-f") {
      i++;
      const val = args[i];
      if (val === "text" || val === "json" || val === "sarif" || val === "html") {
        flags.format = val;
      }
    } else if (arg === "--output" || arg === "-o") {
      i++;
      flags.output = args[i] ?? null;
    } else if (arg === "--policy" || arg === "-p") {
      i++;
      flags.policy = args[i] ?? null;
    } else if (arg === "--platform") {
      i++;
      const val = args[i] as AgentPlatform;
      if (val === "openclaw" || val === "claude" || val === "codex") {
        flags.platform = val;
      }
    } else if (arg === "--path") {
      i++;
      flags.path = args[i] ?? null;
    } else if (arg === "--verbose" || arg === "-v") {
      flags.verbose = true;
    } else if (arg === "--no-color") {
      flags.noColor = true;
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--version" || arg === "-V") {
      flags.version = true;
    } else if (!arg.startsWith("-")) {
      // First positional is the command, rest are args
      if (flags.command === "audit" && i === 0) {
        const validCommands = ["audit", "scan", "report", "policy", "version", "help"];
        if (validCommands.includes(arg)) {
          flags.command = arg;
        } else {
          // Not a recognized command -- treat as positional arg
          flags.args.push(arg);
        }
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
    format:  flags.format  !== "text"    ? flags.format  : (fileConfig.format   ?? "text"),
    output:  flags.output                ?? fileConfig.output  ?? null,
    policy:  flags.policy                ?? fileConfig.policy  ?? null,
    platform: flags.platform !== "openclaw" ? flags.platform : (fileConfig.platform ?? "openclaw"),
    path:    flags.path                  ?? fileConfig.path    ?? null,
    verbose: flags.verbose               || fileConfig.verbose || false,
  };
}
