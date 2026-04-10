import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { stripAnsi } from "../colors.js";
import { ReportGenerator } from "../reporter.js";
import {
  makeEmptyReport,
  makeFinding,
  makeQualityMetrics,
  makeReport,
  makeReportWithManyFindings,
  makeScore,
  makeSkill,
  makeSkillResult,
  makeSummary,
} from "./fixtures.js";

// ── ReportGenerator tests ───────────────────────────────────────────────── //

describe("ReportGenerator", () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    generator = new ReportGenerator();
  });

  describe("generate() with json format", () => {
    test("returns valid JSON string", () => {
      const output = generator.generate(makeReport(), "json");
      expect(() => JSON.parse(output)).not.toThrow();
    });

    test("includes report id in output", () => {
      const output = generator.generate(makeReport(), "json");
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe("report-123");
    });

    test("handles empty findings", () => {
      const output = generator.generate(makeEmptyReport(), "json");
      const parsed = JSON.parse(output);
      expect(parsed.skills[0].securityFindings).toHaveLength(0);
    });

    test("handles many findings", () => {
      const output = generator.generate(makeReportWithManyFindings(), "json");
      const parsed = JSON.parse(output);
      expect(parsed.skills[0].securityFindings).toHaveLength(5);
    });
  });

  describe("generate() with sarif format", () => {
    test("returns valid SARIF JSON", () => {
      const output = generator.generate(makeReport(), "sarif");
      const parsed = JSON.parse(output);
      expect(parsed.$schema).toContain("sarif");
      expect(parsed.version).toBe("2.1.0");
    });

    test("has runs with results", () => {
      const output = generator.generate(makeReport(), "sarif");
      const parsed = JSON.parse(output);
      expect(parsed.runs).toHaveLength(1);
      expect(parsed.runs[0].results).toHaveLength(1);
    });

    test("handles empty findings", () => {
      const output = generator.generate(makeEmptyReport(), "sarif");
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].results).toHaveLength(0);
    });

    test("handles many findings", () => {
      const output = generator.generate(makeReportWithManyFindings(), "sarif");
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].results).toHaveLength(5);
    });
  });

  describe("generate() with html format", () => {
    test("returns HTML starting with DOCTYPE", () => {
      const output = generator.generate(makeReport(), "html");
      expect(output).toStartWith("<!DOCTYPE html>");
    });

    test("contains key HTML structure", () => {
      const output = generator.generate(makeReport(), "html");
      expect(output).toContain("<html");
      expect(output).toContain("</html>");
      expect(output).toContain("<style>");
    });

    test("contains score elements", () => {
      const output = generator.generate(makeReport(), "html");
      expect(output).toContain("gauge-score");
      expect(output).toContain("stat-value");
      expect(output).toContain("score-bar");
    });

    test("handles empty findings", () => {
      const output = generator.generate(makeEmptyReport(), "html");
      expect(output).toContain("No security findings detected");
    });

    test("handles many findings", () => {
      const output = generator.generate(makeReportWithManyFindings(), "html");
      expect(output).toContain("severity-critical");
      expect(output).toContain("severity-high");
      expect(output).toContain("severity-medium");
      expect(output).toContain("severity-low");
      expect(output).toContain("severity-info");
    });
  });

  describe("generate() with text format", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, FORCE_COLOR: "1" };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test("returns non-empty string", () => {
      const output = generator.generate(makeReport(), "text");
      expect(output.length).toBeGreaterThan(0);
    });

    test("contains ANSI codes when color enabled", () => {
      const output = generator.generate(makeReport(), "text");
      expect(output).toMatch(/\x1b\[/);
    });

    test("includes AgentSec branding", () => {
      const output = generator.generate(makeReport(), "text");
      const plain = stripAnsi(output);
      expect(plain).toContain("AgentSec");
    });

    test("includes summary, findings, and quality sections", () => {
      const output = generator.generate(makeReport(), "text");
      const plain = stripAnsi(output);
      expect(plain).toContain("Audit Summary");
      expect(plain).toContain("Security Findings");
      expect(plain).toContain("Quality Metrics");
    });

    test("handles empty findings", () => {
      const output = generator.generate(makeEmptyReport(), "text");
      const plain = stripAnsi(output);
      expect(plain).toContain("No security findings detected");
    });

    test("handles many findings with all severity levels", () => {
      const output = generator.generate(makeReportWithManyFindings(), "text");
      const plain = stripAnsi(output);
      expect(plain).toContain("CRITICAL");
      expect(plain).toContain("HIGH");
      expect(plain).toContain("MEDIUM");
      expect(plain).toContain("LOW");
      expect(plain).toContain("INFO");
    });
  });

  describe("generate() with unsupported format", () => {
    test("throws for unknown format", () => {
      expect(() => generator.generate(makeReport(), "pdf" as never)).toThrow(
        "Unsupported output format",
      );
    });
  });

  describe("multiple skills", () => {
    test("json handles multiple skills", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({ skill: makeSkill({ name: "skill-a" }) }),
          makeSkillResult({ skill: makeSkill({ name: "skill-b", id: "skill-2" }) }),
        ],
        summary: makeSummary({ totalSkills: 2 }),
      });
      const output = generator.generate(report, "json");
      const parsed = JSON.parse(output);
      expect(parsed.skills).toHaveLength(2);
    });

    test("sarif aggregates findings from multiple skills", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({
            skill: makeSkill({ name: "skill-a" }),
            securityFindings: [makeFinding({ id: "f-1", rule: "rule-a" })],
          }),
          makeSkillResult({
            skill: makeSkill({ name: "skill-b", id: "skill-2" }),
            securityFindings: [makeFinding({ id: "f-2", rule: "rule-b" })],
          }),
        ],
      });
      const output = generator.generate(report, "sarif");
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].results).toHaveLength(2);
    });

    test("html renders multiple skill rows", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({ skill: makeSkill({ name: "skill-a" }) }),
          makeSkillResult({ skill: makeSkill({ name: "skill-b", id: "skill-2" }) }),
        ],
      });
      const output = generator.generate(report, "html");
      expect(output).toContain("skill-a");
      expect(output).toContain("skill-b");
    });

    test("text renders multiple skill rows", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({ skill: makeSkill({ name: "skill-a" }) }),
          makeSkillResult({ skill: makeSkill({ name: "skill-b", id: "skill-2" }) }),
        ],
      });
      const output = generator.generate(report, "text");
      const plain = stripAnsi(output);
      expect(plain).toContain("skill-a");
      expect(plain).toContain("skill-b");
    });
  });

  describe("edge cases", () => {
    test("handles skill with null test coverage", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({
            qualityMetrics: makeQualityMetrics({ testCoverage: null }),
          }),
        ],
      });
      const jsonOutput = generator.generate(report, "json");
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.skills[0].qualityMetrics.testCoverage).toBeNull();

      const htmlOutput = generator.generate(report, "html");
      expect(htmlOutput).toContain("n/a");

      const textOutput = generator.generate(report, "text");
      const plain = stripAnsi(textOutput);
      expect(plain).toContain("n/a");
    });

    test("handles skill with zero scores", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({
            score: makeScore({ overall: 0, security: 0, quality: 0, maintenance: 0, grade: "F" }),
          }),
        ],
      });
      const output = generator.generate(report, "json");
      const parsed = JSON.parse(output);
      expect(parsed.skills[0].score.overall).toBe(0);
      expect(parsed.skills[0].score.grade).toBe("F");
    });

    test("handles skill with perfect scores", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({
            score: makeScore({
              overall: 100,
              security: 100,
              quality: 100,
              maintenance: 100,
              grade: "A",
            }),
          }),
        ],
      });
      const output = generator.generate(report, "json");
      const parsed = JSON.parse(output);
      expect(parsed.skills[0].score.overall).toBe(100);
      expect(parsed.skills[0].score.grade).toBe("A");
    });

    test("handles finding without file location", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({
            securityFindings: [
              makeFinding({ file: undefined, line: undefined, column: undefined }),
            ],
          }),
        ],
      });
      // Should not throw for any format
      expect(() => generator.generate(report, "json")).not.toThrow();
      expect(() => generator.generate(report, "sarif")).not.toThrow();
      expect(() => generator.generate(report, "html")).not.toThrow();
      expect(() => generator.generate(report, "text")).not.toThrow();
    });

    test("handles finding without evidence or remediation", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({
            securityFindings: [makeFinding({ evidence: undefined, remediation: undefined })],
          }),
        ],
      });
      expect(() => generator.generate(report, "json")).not.toThrow();
      expect(() => generator.generate(report, "sarif")).not.toThrow();
      expect(() => generator.generate(report, "html")).not.toThrow();
      expect(() => generator.generate(report, "text")).not.toThrow();
    });

    test("handles long skill names in text format", () => {
      const report = makeReport({
        skills: [
          makeSkillResult({
            skill: makeSkill({
              name: "a-very-long-skill-name-that-exceeds-the-column-width-limit",
            }),
          }),
        ],
      });
      // Should truncate gracefully without throwing
      expect(() => generator.generate(report, "text")).not.toThrow();
    });
  });
});
