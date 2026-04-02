/**
 * Policy command -- list presets, validate policy config files,
 * and show policy details.
 *
 * Usage:
 *   agent-audit policy list             List available policy presets
 *   agent-audit policy show <name>      Show rules in a policy
 *   agent-audit policy validate <file>  Validate a custom policy config
 */

import type { PolicyConfig } from "@agent-audit/shared";

import type { AuditConfig } from "../config";
import { color, error, heading, info, severityBadge, success } from "../ui";

// ---------------------------------------------------------------------------
// Built-in presets (available even if @agent-audit/policy is not built yet)
// ---------------------------------------------------------------------------

interface PresetInfo {
  name: string;
  description: string;
  ruleCount: number;
}

const BUILT_IN_PRESETS: PresetInfo[] = [
  {
    name: "default",
    description: "Balanced policy suitable for most projects. Blocks critical findings.",
    ruleCount: 5,
  },
  {
    name: "strict",
    description: "Enterprise-grade policy. Blocks high and critical findings, enforces tests.",
    ruleCount: 10,
  },
  {
    name: "permissive",
    description: "Lenient policy for development. Only blocks critical CVEs.",
    ruleCount: 3,
  },
  {
    name: "owasp-agent-top-10",
    description: "Policy based on the OWASP Top 10 for AI Agent Skills.",
    ruleCount: 10,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadPolicyPresets(): Promise<PresetInfo[]> {
  try {
    const policy = await import("@agent-audit/policy");

    // The policy package returns string[] from listPresets() and has
    // getPreset(name) to retrieve the full PolicyConfig.
    const listFn = policy.listPresets ?? policy.default?.listPresets;
    const getFn = policy.getPreset ?? policy.default?.getPreset;

    if (typeof listFn === "function" && typeof getFn === "function") {
      const names: string[] = listFn();
      return names.map((name: string) => {
        const config = getFn(name) as PolicyConfig | null;
        return {
          name,
          description: config?.rules
            ? `${config.rules.length} rule(s) covering security and quality checks`
            : "Policy preset",
          ruleCount: config?.rules?.length ?? 0,
        };
      });
    }
  } catch {
    // Package not yet implemented
  }
  return BUILT_IN_PRESETS;
}

async function loadPolicy(nameOrPath: string): Promise<PolicyConfig | null> {
  try {
    const policy = await import("@agent-audit/policy");

    // Try loading as a preset name first, then as a file path
    const getFn = policy.getPreset ?? policy.default?.getPreset;
    const loadFn = policy.loadPolicyFile ?? policy.default?.loadPolicyFile;

    if (typeof getFn === "function") {
      const preset = getFn(nameOrPath) as PolicyConfig | null;
      if (preset) return preset;
    }

    if (typeof loadFn === "function") {
      return await loadFn(nameOrPath);
    }
  } catch {
    // Package not yet implemented
  }
  return null;
}

async function validatePolicyFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return { valid: false, errors: [`File not found: ${filePath}`] };
    }

    const text = await file.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      return { valid: false, errors: ["Invalid JSON syntax"] };
    }

    if (typeof parsed !== "object" || parsed === null) {
      return { valid: false, errors: ["Config must be a JSON object"] };
    }

    const config = parsed as Record<string, unknown>;

    if (!config.name || typeof config.name !== "string") {
      errors.push("Missing or invalid 'name' field (must be a string)");
    }

    if (!Array.isArray(config.rules)) {
      errors.push("Missing or invalid 'rules' field (must be an array)");
    } else {
      for (let i = 0; i < config.rules.length; i++) {
        const rule = config.rules[i] as Record<string, unknown>;
        if (!rule.id) errors.push(`Rule ${i}: missing 'id'`);
        if (!rule.description) errors.push(`Rule ${i}: missing 'description'`);
        if (!rule.severity) errors.push(`Rule ${i}: missing 'severity'`);
        if (!rule.action) errors.push(`Rule ${i}: missing 'action'`);
        if (!rule.condition) {
          errors.push(`Rule ${i}: missing 'condition'`);
        } else {
          const cond = rule.condition as Record<string, unknown>;
          const validTypes = [
            "score-below",
            "finding-exists",
            "permission-used",
            "dependency-banned",
            "custom",
          ];
          if (!cond.type || !validTypes.includes(cond.type as string)) {
            errors.push(`Rule ${i}: invalid condition type '${cond.type}'`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

// ---------------------------------------------------------------------------
// Sub-command: list
// ---------------------------------------------------------------------------

async function listPresets(): Promise<number> {
  heading("Available Policy Presets");

  const presets = await loadPolicyPresets();

  for (const preset of presets) {
    console.log(`  ${color.bold(color.cyan(preset.name))}`);
    console.log(`  ${preset.description}`);
    console.log(`  ${color.dim(`${preset.ruleCount} rules`)}`);
    console.log();
  }

  info(`Use ${color.bold("agent-audit policy show <name>")} to see rules`);
  info(`Use ${color.bold("--policy <name>")} with the audit command to apply a preset`);
  console.log();

  return 0;
}

// ---------------------------------------------------------------------------
// Sub-command: show
// ---------------------------------------------------------------------------

async function showPolicy(name: string): Promise<number> {
  const policy = await loadPolicy(name);

  if (!policy) {
    error(`Policy not found: ${name}`);
    info("Use 'agent-audit policy list' to see available presets");
    return 1;
  }

  heading(`Policy: ${policy.name}`);

  for (const rule of policy.rules) {
    console.log(`  ${severityBadge(rule.severity)} ${color.bold(rule.id)}`);
    console.log(`  ${rule.description}`);
    console.log(`  ${color.dim(`Action: ${rule.action}  |  Condition: ${rule.condition.type}`)}`);
    console.log();
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Sub-command: validate
// ---------------------------------------------------------------------------

async function validate(filePath: string): Promise<number> {
  heading("Validating Policy Config");

  info(`File: ${color.underline(filePath)}`);
  console.log();

  const result = await validatePolicyFile(filePath);

  if (result.valid) {
    success("Policy config is valid");
    console.log();
    return 0;
  }

  error("Policy config has errors:");
  for (const err of result.errors) {
    console.log(`    ${color.red("\u2022")} ${err}`);
  }
  console.log();
  return 1;
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export async function runPolicy(_config: AuditConfig, args: string[]): Promise<number> {
  const subcommand = args[0] ?? "list";

  switch (subcommand) {
    case "list":
      return listPresets();
    case "show":
      if (!args[1]) {
        error("Missing policy name");
        info("Usage: agent-audit policy show <name>");
        return 1;
      }
      return showPolicy(args[1]);
    case "validate":
      if (!args[1]) {
        error("Missing file path");
        info("Usage: agent-audit policy validate <file>");
        return 1;
      }
      return validate(args[1]);
    default:
      error(`Unknown policy subcommand: ${subcommand}`);
      console.log();
      console.log(`  ${color.bold("Available subcommands:")}`);
      console.log(`    list        List available policy presets`);
      console.log(`    show        Show rules in a policy`);
      console.log(`    validate    Validate a custom policy config file`);
      console.log();
      return 1;
  }
}
