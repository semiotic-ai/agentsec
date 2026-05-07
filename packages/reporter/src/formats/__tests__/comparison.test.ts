/**
 * Tests for the multi-skill comparison renderers.
 */

import { describe, expect, test } from "bun:test";
import type { AuditReport, SkillAuditResult } from "@agentsec/shared";
import { makeFinding, makeReport, makeSkill, makeSkillResult } from "../../__tests__/fixtures.js";
import { formatComparisonHtml } from "../comparison-html.js";
import { buildComparison, formatComparisonJson } from "../comparison-json.js";
import { formatComparisonMd } from "../comparison-md.js";
import { formatHtml } from "../html.js";

const twoSkillReport = (): AuditReport => {
  const skillA: SkillAuditResult = makeSkillResult({
    skill: makeSkill({ id: "a", name: "alpha-router", version: "0.1.0" }),
    score: { overall: 85, security: 90, quality: 80, maintenance: 85, grade: "B" },
    securityFindings: [
      makeFinding({
        id: "a-1",
        severity: "high",
        rule: "web3-permit-capture",
        owaspId: "AST-W02",
        owaspLink: "https://example.com/AST-W02",
        title: "Unbounded Permit2 spender",
      }),
    ],
  });
  const skillB: SkillAuditResult = makeSkillResult({
    skill: makeSkill({ id: "b", name: "beta-router", version: "0.2.0" }),
    score: { overall: 45, security: 30, quality: 60, maintenance: 50, grade: "F" },
    securityFindings: [
      makeFinding({
        id: "b-1",
        severity: "critical",
        rule: "web3-permit-capture",
        owaspId: "AST-W02",
        owaspLink: "https://example.com/AST-W02",
        title: "Unbounded Permit2 spender",
      }),
      makeFinding({
        id: "b-2",
        severity: "medium",
        rule: "injection",
        owaspId: "AST01",
        owaspLink: "https://example.com/AST01",
        title: "Eval usage",
      }),
    ],
  });
  return makeReport({
    skills: [skillA, skillB],
    summary: {
      totalSkills: 2,
      averageScore: 65,
      criticalFindings: 1,
      highFindings: 1,
      mediumFindings: 1,
      lowFindings: 0,
      blockedSkills: 0,
      certifiedSkills: 1,
    },
  });
};

describe("buildComparison", () => {
  test("sorts skills by overall score descending", () => {
    const view = buildComparison(twoSkillReport());
    expect(view.skills.map((s) => s.name)).toEqual(["alpha-router", "beta-router"]);
    expect(view.summary.bestSkill).toBe("alpha-router");
    expect(view.summary.worstSkill).toBe("beta-router");
    expect(view.summary.avgScore).toBe(65);
    expect(view.summary.totalFindings).toBe(3);
  });

  test("groups rules into AST and AST-W categories", () => {
    const view = buildComparison(twoSkillReport());
    const categories = view.ruleGroups.map((g) => g.category);
    expect(categories).toContain("AST");
    expect(categories).toContain("AST-W");
  });

  test("emits one cell per skill in the same order", () => {
    const view = buildComparison(twoSkillReport());
    const w02 = view.ruleGroups.flatMap((g) => g.rules).find((r) => r.id === "AST-W02");
    expect(w02).toBeDefined();
    if (!w02) return;
    expect(w02.cells.map((c) => c.skill)).toEqual(["alpha-router", "beta-router"]);
    // alpha has 1 high finding for AST-W02; beta has 1 critical.
    expect(w02.cells[0]).toMatchObject({ severity: "high", count: 1 });
    expect(w02.cells[1]).toMatchObject({ severity: "critical", count: 1 });
  });

  test("excludes rules with no findings across skills", () => {
    const view = buildComparison(twoSkillReport());
    const ids = view.ruleGroups.flatMap((g) => g.rules.map((r) => r.id));
    expect(ids).toEqual(expect.arrayContaining(["AST01", "AST-W02"]));
    expect(ids).not.toContain("AST05");
  });

  test("missing finding for a (skill, rule) pair becomes a pass cell", () => {
    const view = buildComparison(twoSkillReport());
    const ast01 = view.ruleGroups.flatMap((g) => g.rules).find((r) => r.id === "AST01");
    expect(ast01).toBeDefined();
    if (!ast01) return;
    expect(ast01.cells[0]).toMatchObject({ severity: "pass", count: 0 });
    expect(ast01.cells[1]).toMatchObject({ severity: "medium", count: 1 });
  });
});

describe("formatComparisonHtml", () => {
  test("returns empty string for single-skill report", () => {
    const single = makeReport();
    expect(formatComparisonHtml(single)).toBe("");
  });

  test("renders matrix table for >=2 skills", () => {
    const html = formatComparisonHtml(twoSkillReport());
    expect(html).toContain('<section class="comparison-view">');
    expect(html).toContain('class="cmp-matrix"');
    expect(html).toContain("alpha-router");
    expect(html).toContain("beta-router");
    expect(html).toContain("AST-W02");
    expect(html).toContain("AST01");
    // legend
    expect(html).toContain("Critical");
    expect(html).toContain("Pass");
  });

  test("colors severity cells using severity bg colors", () => {
    const html = formatComparisonHtml(twoSkillReport());
    // critical = #ff4d4f, high = #ff7a45
    expect(html).toContain("#ff4d4f");
    expect(html).toContain("#ff7a45");
  });
});

describe("formatHtml integration", () => {
  test("single-skill report does NOT contain the comparison section", () => {
    const html = formatHtml(makeReport());
    expect(html).not.toContain('<section class="comparison-view">');
  });

  test("multi-skill report contains the comparison section", () => {
    const html = formatHtml(twoSkillReport());
    expect(html).toContain('<section class="comparison-view">');
  });
});

describe("formatComparisonMd", () => {
  test("renders a Markdown table for >=2 skills", () => {
    const md = formatComparisonMd(twoSkillReport());
    expect(md).toContain("# AgentSec Comparison Report");
    expect(md).toContain("## Comparison Matrix");
    expect(md).toContain("| Skill |");
    expect(md).toContain("alpha-router");
    expect(md).toContain("beta-router");
    expect(md).toContain("AST-W02");
    // emoji severity icons
    expect(md).toMatch(/🔴|🟠|🟡|🟢|⚪/);
  });

  test("falls back to single-skill formatter for one skill", () => {
    const md = formatComparisonMd(makeReport());
    expect(md).toContain("# AgentSec Report");
    expect(md).not.toContain("## Comparison Matrix");
  });
});

describe("formatComparisonJson", () => {
  test("produces JSON with skills, ruleGroups, and summary", () => {
    const json = formatComparisonJson(twoSkillReport());
    const parsed = JSON.parse(json);
    expect(parsed.skills).toHaveLength(2);
    expect(parsed.ruleGroups.length).toBeGreaterThan(0);
    expect(parsed.summary.bestSkill).toBe("alpha-router");
    expect(parsed.summary.totalFindings).toBe(3);
  });
});
