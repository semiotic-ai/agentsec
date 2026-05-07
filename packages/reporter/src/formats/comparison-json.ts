/**
 * Comparison view JSON formatter and shared aggregation logic.
 *
 * `buildComparison(report)` collapses a multi-skill `AuditReport` into a
 * matrix of skills × AST/AST-W rules with severity-coded cells. The HTML
 * and Markdown comparison renderers consume the same shape so they stay
 * consistent.
 *
 * The matrix only includes rules that produced at least one finding across
 * the included skills — empty columns add noise to a side-by-side view.
 */

import type { AuditReport, SecurityFinding, SkillAuditResult } from "@agentsec/shared";

/** Severity used in a comparison cell. `pass` means no finding for this rule. */
export type CellSeverity = "critical" | "high" | "medium" | "low" | "pass";

export interface ComparisonSkill {
  name: string;
  version: string;
  score: number;
  grade: string;
}

export interface ComparisonCell {
  skill: string;
  severity: CellSeverity;
  count: number;
}

export interface ComparisonRule {
  /** OWASP identifier, e.g. "AST01" or "AST-W02". */
  id: string;
  /** Short human-readable rule title. */
  title: string;
  /** Optional canonical link for the rule (OWASP page or annex doc). */
  link?: string;
  /** One cell per skill, in the same order as `ComparisonView.skills`. */
  cells: ComparisonCell[];
}

export interface ComparisonRuleGroup {
  category: "AST" | "AST-W";
  rules: ComparisonRule[];
}

export interface ComparisonSummary {
  bestSkill: string;
  worstSkill: string;
  avgScore: number;
  totalFindings: number;
}

export interface ComparisonView {
  skills: ComparisonSkill[];
  ruleGroups: ComparisonRuleGroup[];
  summary: ComparisonSummary;
}

const SEVERITY_RANK: Record<CellSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  pass: 0,
};

/** Pick the worst severity among findings for a single (skill, rule) cell. */
const worstSeverity = (findings: SecurityFinding[]): CellSeverity => {
  let worst: CellSeverity = "pass";
  for (const f of findings) {
    if (f.severity === "info") continue;
    if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst]) {
      worst = f.severity;
    }
  }
  return worst;
};

/**
 * Strip the leading "AST##: " or "AST-W##: " prefix some rule descriptions
 * have so the matrix column header is concise.
 */
const titleFromDescription = (id: string, description: string): string => {
  const cleaned = description.replace(/\s*\(AST[-\w]*\)\s*$/i, "").trim();
  return cleaned.length > 0 ? cleaned : id;
};

/**
 * Walk every finding in the report and group by `owaspId`. Each (skill, rule)
 * pair maps to one cell in the matrix. Rules with no findings across all
 * skills are excluded from the output.
 */
const collectRules = (results: SkillAuditResult[], skillNames: string[]): ComparisonRuleGroup[] => {
  interface RuleAccum {
    id: string;
    title: string;
    link?: string;
    /** skillName -> findings for this rule */
    perSkill: Map<string, SecurityFinding[]>;
  }

  const rules = new Map<string, RuleAccum>();

  for (const r of results) {
    for (const f of r.securityFindings) {
      const id = f.owaspId;
      if (!id) continue;
      let entry = rules.get(id);
      if (!entry) {
        entry = {
          id,
          title: titleFromDescription(id, f.title),
          link: f.owaspLink,
          perSkill: new Map(),
        };
        rules.set(id, entry);
      }
      let bucket = entry.perSkill.get(r.skill.name);
      if (!bucket) {
        bucket = [];
        entry.perSkill.set(r.skill.name, bucket);
      }
      bucket.push(f);
    }
  }

  const ast: ComparisonRule[] = [];
  const web3: ComparisonRule[] = [];
  for (const entry of rules.values()) {
    const rule: ComparisonRule = {
      id: entry.id,
      title: entry.title,
      link: entry.link,
      cells: skillNames.map((name) => {
        const findings = entry.perSkill.get(name) ?? [];
        return {
          skill: name,
          severity: worstSeverity(findings),
          count: findings.length,
        };
      }),
    };
    (entry.id.startsWith("AST-W") ? web3 : ast).push(rule);
  }

  const byNumericId = (a: ComparisonRule, b: ComparisonRule): number => {
    const aNum = Number.parseInt(a.id.replace(/[^\d]/g, ""), 10) || 0;
    const bNum = Number.parseInt(b.id.replace(/[^\d]/g, ""), 10) || 0;
    return aNum - bNum;
  };
  ast.sort(byNumericId);
  web3.sort(byNumericId);

  const groups: ComparisonRuleGroup[] = [];
  if (ast.length > 0) groups.push({ category: "AST", rules: ast });
  if (web3.length > 0) groups.push({ category: "AST-W", rules: web3 });
  return groups;
};

/**
 * Aggregate an `AuditReport` into a side-by-side comparison view. Skills are
 * sorted by overall score descending so the strongest skill is the leftmost
 * column.
 */
export const buildComparison = (report: AuditReport): ComparisonView => {
  const sorted = [...report.skills].sort((a, b) => b.score.overall - a.score.overall);

  const skills: ComparisonSkill[] = sorted.map((r) => ({
    name: r.skill.name,
    version: r.skill.version,
    score: r.score.overall,
    grade: r.score.grade,
  }));

  const skillNames = skills.map((s) => s.name);
  const ruleGroups = collectRules(sorted, skillNames);

  const totalFindings = sorted.reduce((sum, r) => sum + r.securityFindings.length, 0);
  const avgScore =
    skills.length === 0
      ? 0
      : Math.round(skills.reduce((sum, s) => sum + s.score, 0) / skills.length);
  const bestSkill = skills[0]?.name ?? "";
  const worstSkill = skills[skills.length - 1]?.name ?? "";

  return {
    skills,
    ruleGroups,
    summary: { bestSkill, worstSkill, avgScore, totalFindings },
  };
};

/** Pretty-printed JSON of `buildComparison(report)`. */
export const formatComparisonJson = (report: AuditReport): string =>
  JSON.stringify(buildComparison(report), null, 2);
