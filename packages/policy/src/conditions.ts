import type { OWASPCategory, PolicyCondition, Severity, SkillAuditResult } from "@agentsec/shared";

/**
 * Result of evaluating a condition against an audit result.
 * `met` is true when the condition fires (i.e. the rule applies).
 */
export interface ConditionResult {
  met: boolean;
  reason: string;
}

/**
 * A condition evaluator receives the typed value from a PolicyCondition
 * and the audit result to test, returning whether the condition is met.
 */
export type ConditionEvaluator = (value: unknown, result: SkillAuditResult) => ConditionResult;

// ---------------------------------------------------------------------------
// score-below
// ---------------------------------------------------------------------------

export interface ScoreBelowValue {
  /** Which score bucket to check. Defaults to "overall". */
  field?: "overall" | "security" | "quality" | "maintenance";
  /** Threshold. The condition fires when the score is strictly below this. */
  threshold: number;
}

function evaluateScoreBelow(value: unknown, result: SkillAuditResult): ConditionResult {
  const v = value as ScoreBelowValue;
  const field = v.field ?? "overall";
  const threshold = v.threshold;

  if (typeof threshold !== "number" || threshold < 0 || threshold > 100) {
    return { met: false, reason: `Invalid threshold: ${threshold}` };
  }

  const actual = result.score[field];
  if (actual < threshold) {
    return {
      met: true,
      reason: `${field} score ${actual} is below threshold ${threshold}`,
    };
  }
  return {
    met: false,
    reason: `${field} score ${actual} meets threshold ${threshold}`,
  };
}

// ---------------------------------------------------------------------------
// finding-exists
// ---------------------------------------------------------------------------

export interface FindingExistsValue {
  /** Severity levels to match. If omitted, any severity matches. */
  severity?: Severity[];
  /** OWASP categories to match. If omitted, any category matches. */
  category?: OWASPCategory[];
  /** If true, only match findings that have an associated CVE. */
  withCve?: boolean;
}

function evaluateFindingExists(value: unknown, result: SkillAuditResult): ConditionResult {
  const v = value as FindingExistsValue;
  const findings = result.securityFindings;

  const matched = findings.filter((f) => {
    if (v.severity && v.severity.length > 0 && !v.severity.includes(f.severity)) {
      return false;
    }
    if (v.category && v.category.length > 0 && !v.category.includes(f.category)) {
      return false;
    }
    if (v.withCve && !f.cve) {
      return false;
    }
    return true;
  });

  if (matched.length > 0) {
    const summaries = matched
      .slice(0, 3)
      .map((f) => `${f.severity}:${f.category}(${f.id})`)
      .join(", ");
    const extra = matched.length > 3 ? ` and ${matched.length - 3} more` : "";
    return {
      met: true,
      reason: `Found ${matched.length} matching finding(s): ${summaries}${extra}`,
    };
  }

  return { met: false, reason: "No matching findings found" };
}

// ---------------------------------------------------------------------------
// permission-used
// ---------------------------------------------------------------------------

export interface PermissionUsedValue {
  /** List of banned permissions. Condition fires if the skill uses any. */
  banned: string[];
}

function evaluatePermissionUsed(value: unknown, result: SkillAuditResult): ConditionResult {
  const v = value as PermissionUsedValue;
  const permissions = result.skill.manifest.permissions ?? [];
  const violations = permissions.filter((p) => v.banned.includes(p));

  if (violations.length > 0) {
    return {
      met: true,
      reason: `Skill uses banned permission(s): ${violations.join(", ")}`,
    };
  }

  return { met: false, reason: "No banned permissions used" };
}

// ---------------------------------------------------------------------------
// dependency-banned
// ---------------------------------------------------------------------------

export interface DependencyBannedValue {
  /** List of banned dependency names. */
  banned: string[];
}

function evaluateDependencyBanned(value: unknown, result: SkillAuditResult): ConditionResult {
  const v = value as DependencyBannedValue;
  const deps = Object.keys(result.skill.manifest.dependencies ?? {});
  const violations = deps.filter((d) => v.banned.includes(d));

  if (violations.length > 0) {
    return {
      met: true,
      reason: `Skill uses banned dependency/ies: ${violations.join(", ")}`,
    };
  }

  return { met: false, reason: "No banned dependencies found" };
}

// ---------------------------------------------------------------------------
// custom
// ---------------------------------------------------------------------------

export interface CustomConditionValue {
  /**
   * A JavaScript expression that will be evaluated with `result` in scope.
   * Must return a boolean.
   *
   * Example: "result.qualityMetrics.testCoverage !== null && result.qualityMetrics.testCoverage < 50"
   */
  expression: string;
  /** Human-readable label for reporting. */
  label?: string;
}

function evaluateCustom(value: unknown, result: SkillAuditResult): ConditionResult {
  const v = value as CustomConditionValue;

  if (!v.expression || typeof v.expression !== "string") {
    return { met: false, reason: "Invalid custom expression" };
  }

  try {
    // Build a function that receives the audit result and evaluates the expression.
    const fn = new Function("result", `"use strict"; return Boolean(${v.expression});`);
    const met = fn(result) as boolean;
    const label = v.label ?? v.expression;
    return {
      met,
      reason: met ? `Custom condition met: ${label}` : `Custom condition not met: ${label}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { met: false, reason: `Custom expression error: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const evaluators: Record<PolicyCondition["type"], ConditionEvaluator> = {
  "score-below": evaluateScoreBelow,
  "finding-exists": evaluateFindingExists,
  "permission-used": evaluatePermissionUsed,
  "dependency-banned": evaluateDependencyBanned,
  custom: evaluateCustom,
};

/**
 * Evaluate a policy condition against an audit result.
 */
export function evaluateCondition(
  condition: PolicyCondition,
  result: SkillAuditResult,
): ConditionResult {
  const evaluator = evaluators[condition.type];
  if (!evaluator) {
    return { met: false, reason: `Unknown condition type: ${condition.type}` };
  }
  return evaluator(condition.value, result);
}
