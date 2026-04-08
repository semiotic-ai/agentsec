import type { AgentSkill, ScannerPlugin, SecurityFinding } from "@agentsec/shared";
import { ALL_RULES, type RuleDefinition } from "./rules";

export type RuleFunction = (skill: AgentSkill) => SecurityFinding[];

export interface ScanOptions {
  /** Which OWASP categories to run (default: all). Use OWASPCategory values. */
  categories?: string[];
  /** Additional custom plugins that implement the ScannerPlugin interface */
  plugins?: ScannerPlugin[];
  /** Skip findings from specific rule names (e.g., "injection", "dos") */
  skipRules?: string[];
  /** Enable verbose logging to stderr */
  verbose?: boolean;
}

/**
 * Security scanner engine for AI agent skills.
 *
 * Runs a configurable set of built-in rules and optional plugins
 * against an AgentSkill, producing an array of SecurityFinding results
 * sorted by severity.
 *
 * Usage:
 * ```ts
 * const scanner = new Scanner();
 * const findings = await scanner.scan(skill);
 * ```
 */
export class Scanner {
  private rules: RuleDefinition[];
  private plugins: ScannerPlugin[];
  private skipRules: Set<string>;
  private verbose: boolean;

  constructor(options: ScanOptions = {}) {
    const { categories, plugins = [], skipRules = [], verbose = false } = options;

    this.rules = categories
      ? ALL_RULES.filter((r) => categories.includes(r.category))
      : [...ALL_RULES];

    this.plugins = plugins;
    this.skipRules = new Set(skipRules);
    this.verbose = verbose;
  }

  /**
   * Scan a single skill and return all security findings.
   * Results are sorted by severity (critical first).
   */
  async scan(skill: AgentSkill): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Run built-in rules (synchronous)
    for (const rule of this.rules) {
      try {
        if (this.verbose) {
          process.stderr.write(`  Running rule: ${rule.name}...\n`);
        }

        const startTime = performance.now();
        const ruleFindings = rule.run(skill);
        const elapsed = performance.now() - startTime;

        if (this.verbose) {
          process.stderr.write(
            `  Rule ${rule.name} completed: ${ruleFindings.length} findings in ${elapsed.toFixed(1)}ms\n`,
          );
        }

        // Filter out skipped rules
        const filtered = ruleFindings.filter((f) => !this.skipRules.has(f.rule));
        findings.push(...filtered);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (this.verbose) {
          process.stderr.write(`  Rule ${rule.name} failed: ${message}\n`);
        }
        // Add a meta-finding for the scanner failure
        findings.push({
          id: `SCANNER-ERR-${rule.name}`,
          rule: "scanner-internal",
          severity: "info",
          category: "skill-injection",
          title: `Scanner rule '${rule.name}' threw an error`,
          description: `The '${rule.name}' rule encountered an error during scanning: ${message}. Some findings may be missing.`,
          remediation:
            "This is a scanner issue, not a skill issue. Report this to the scanner maintainers.",
        });
      }
    }

    // Run plugins (async)
    for (const plugin of this.plugins) {
      try {
        if (this.verbose) {
          process.stderr.write(`  Running plugin: ${plugin.name} v${plugin.version}...\n`);
        }

        const startTime = performance.now();
        const pluginFindings = await plugin.scan(skill);
        const elapsed = performance.now() - startTime;

        if (this.verbose) {
          process.stderr.write(
            `  Plugin ${plugin.name} completed: ${pluginFindings.length} findings in ${elapsed.toFixed(1)}ms\n`,
          );
        }

        findings.push(...pluginFindings);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (this.verbose) {
          process.stderr.write(`  Plugin ${plugin.name} failed: ${message}\n`);
        }
      }
    }

    // Sort by severity (critical > high > medium > low > info)
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };
    findings.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

    return findings;
  }

  /**
   * Scan multiple skills and return findings indexed by skill ID.
   */
  async scanAll(skills: AgentSkill[]): Promise<Map<string, SecurityFinding[]>> {
    const results = new Map<string, SecurityFinding[]>();

    for (const skill of skills) {
      const findings = await this.scan(skill);
      results.set(skill.id, findings);
    }

    return results;
  }

  /** Get the total number of active rules (built-in + plugins). */
  getRuleCount(): number {
    return this.rules.length + this.plugins.length;
  }

  /** List all active rule names and their categories. */
  listRules(): string[] {
    return [
      ...this.rules.map((r) => `${r.name} (${r.category})`),
      ...this.plugins.map((p) => `${p.name} v${p.version} (plugin)`),
    ];
  }

  /** Get the active rule definitions. */
  getRules(): readonly RuleDefinition[] {
    return this.rules;
  }
}
