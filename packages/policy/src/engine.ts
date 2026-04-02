import type { PolicyConfig, PolicyViolation, SkillAuditResult } from "@agent-audit/shared";
import { evaluateCondition } from "./conditions";
import { getPreset } from "./presets";

/**
 * PolicyEngine evaluates audit results against a loaded policy configuration
 * and produces policy violations.
 */
export class PolicyEngine {
  private policy: PolicyConfig | null = null;

  /**
   * Load a policy configuration into the engine.
   *
   * Accepts either a full PolicyConfig or a preset name string.
   * Throws if a preset name is given but not recognized.
   */
  loadPolicy(config: PolicyConfig | string): void {
    if (typeof config === "string") {
      const preset = getPreset(config);
      if (!preset) {
        throw new Error(
          `Unknown policy preset: "${config}". Available presets: strict, standard, permissive, enterprise`,
        );
      }
      this.policy = preset;
    } else {
      this.policy = config;
    }
  }

  /**
   * Get the currently loaded policy, or null if none is loaded.
   */
  getPolicy(): PolicyConfig | null {
    return this.policy;
  }

  /**
   * Evaluate an audit result against the loaded policy.
   *
   * Returns an array of PolicyViolation for every rule whose condition is met.
   * Throws if no policy has been loaded.
   */
  evaluate(auditResult: SkillAuditResult): PolicyViolation[] {
    if (!this.policy) {
      throw new Error("No policy loaded. Call loadPolicy() first.");
    }

    const violations: PolicyViolation[] = [];

    for (const rule of this.policy.rules) {
      const result = evaluateCondition(rule.condition, auditResult);

      if (result.met) {
        violations.push({
          policy: rule.id,
          severity: rule.severity,
          message: `${rule.description}: ${result.reason}`,
          action: rule.action,
        });
      }
    }

    return violations;
  }

  /**
   * Determine whether the given set of violations should block the skill.
   *
   * A skill is blocked if any violation has action === "block".
   */
  shouldBlock(violations: PolicyViolation[]): boolean {
    return violations.some((v) => v.action === "block");
  }

  /**
   * Convenience method: evaluate and return a structured result.
   */
  check(auditResult: SkillAuditResult): PolicyCheckResult {
    const violations = this.evaluate(auditResult);
    const blocked = this.shouldBlock(violations);
    const warnings = violations.filter((v) => v.action === "warn");
    const infos = violations.filter((v) => v.action === "info");
    const blocks = violations.filter((v) => v.action === "block");

    return {
      blocked,
      violations,
      blocks,
      warnings,
      infos,
      summary: blocked
        ? `Skill blocked: ${blocks.length} blocking violation(s)`
        : violations.length > 0
          ? `Skill passed with ${warnings.length} warning(s) and ${infos.length} info(s)`
          : "Skill passed all policy checks",
    };
  }
}

/**
 * Structured result from a policy check.
 */
export interface PolicyCheckResult {
  /** Whether the skill should be blocked from running. */
  blocked: boolean;
  /** All violations found. */
  violations: PolicyViolation[];
  /** Violations with action "block". */
  blocks: PolicyViolation[];
  /** Violations with action "warn". */
  warnings: PolicyViolation[];
  /** Violations with action "info". */
  infos: PolicyViolation[];
  /** Human-readable summary string. */
  summary: string;
}
