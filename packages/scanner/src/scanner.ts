import type { AgentSkill, SecurityFinding, ScannerPlugin } from "@agent-audit/shared";
import {
  checkInjection,
  checkExcessivePermissions,
  checkDependencyVulnerabilities,
  checkInsecureOutput,
  checkInsecureStorage,
  checkSupplyChain,
  checkErrorHandling,
  checkUnsafeDeserialization,
  checkDenialOfService,
  checkInsufficientLogging,
} from "./rules";

export type RuleFunction = (skill: AgentSkill) => SecurityFinding[];

export interface ScanOptions {
  /** Which rule categories to run (default: all) */
  categories?: string[];
  /** Additional custom plugins */
  plugins?: ScannerPlugin[];
  /** Skip specific rule IDs */
  skipRules?: string[];
  /** Enable verbose logging */
  verbose?: boolean;
}

interface RuleEntry {
  name: string;
  category: string;
  fn: RuleFunction;
}

const BUILT_IN_RULES: RuleEntry[] = [
  { name: "injection", category: "skill-injection", fn: checkInjection },
  { name: "permissions", category: "excessive-permissions", fn: checkExcessivePermissions },
  { name: "dependencies", category: "dependency-vulnerability", fn: checkDependencyVulnerabilities },
  { name: "output-handling", category: "insecure-output", fn: checkInsecureOutput },
  { name: "storage", category: "insecure-storage", fn: checkInsecureStorage },
  { name: "supply-chain", category: "supply-chain", fn: checkSupplyChain },
  { name: "error-handling", category: "improper-error-handling", fn: checkErrorHandling },
  { name: "deserialization", category: "unsafe-deserialization", fn: checkUnsafeDeserialization },
  { name: "dos", category: "denial-of-service", fn: checkDenialOfService },
  { name: "logging", category: "insufficient-logging", fn: checkInsufficientLogging },
];

export class Scanner {
  private rules: RuleEntry[];
  private plugins: ScannerPlugin[];
  private skipRules: Set<string>;
  private verbose: boolean;

  constructor(options: ScanOptions = {}) {
    const { categories, plugins = [], skipRules = [], verbose = false } = options;

    this.rules = categories
      ? BUILT_IN_RULES.filter((r) => categories.includes(r.category))
      : [...BUILT_IN_RULES];

    this.plugins = plugins;
    this.skipRules = new Set(skipRules);
    this.verbose = verbose;
  }

  async scan(skill: AgentSkill): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Run built-in rules
    for (const rule of this.rules) {
      try {
        if (this.verbose) {
          process.stderr.write(`  Running rule: ${rule.name}...\n`);
        }
        const ruleFindings = rule.fn(skill);
        const filtered = ruleFindings.filter((f) => !this.skipRules.has(f.rule));
        findings.push(...filtered);
      } catch (err) {
        if (this.verbose) {
          process.stderr.write(`  Rule ${rule.name} failed: ${err}\n`);
        }
      }
    }

    // Run plugins
    for (const plugin of this.plugins) {
      try {
        if (this.verbose) {
          process.stderr.write(`  Running plugin: ${plugin.name}...\n`);
        }
        const pluginFindings = await plugin.scan(skill);
        findings.push(...pluginFindings);
      } catch (err) {
        if (this.verbose) {
          process.stderr.write(`  Plugin ${plugin.name} failed: ${err}\n`);
        }
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return findings;
  }

  async scanAll(skills: AgentSkill[]): Promise<Map<string, SecurityFinding[]>> {
    const results = new Map<string, SecurityFinding[]>();

    for (const skill of skills) {
      const findings = await this.scan(skill);
      results.set(skill.id, findings);
    }

    return results;
  }

  getRuleCount(): number {
    return this.rules.length + this.plugins.length;
  }

  listRules(): string[] {
    return [
      ...this.rules.map((r) => `${r.name} (${r.category})`),
      ...this.plugins.map((p) => `${p.name} v${p.version} (plugin)`),
    ];
  }
}
