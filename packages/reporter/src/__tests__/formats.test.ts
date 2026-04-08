import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { AuditGrade, Severity } from "@agentsec/shared";
import {
  bold,
  box,
  center,
  dim,
  gradeColor,
  green,
  padEnd,
  padStart,
  progressBar,
  red,
  scoreGauge,
  severityColor,
  stripAnsi,
  symbols,
  visibleLength,
} from "../colors.js";
import { formatHtml } from "../formats/html.js";
import { formatJson } from "../formats/json.js";
import { formatSarif } from "../formats/sarif.js";
import { formatText } from "../formats/text.js";
import {
  makeEmptyReport,
  makeFinding,
  makeReport,
  makeReportWithManyFindings,
  makeSkill,
  makeSkillResult,
} from "./fixtures.js";

// ── JSON formatter tests ────────────────────────────────────────────────── //

describe("formatJson", () => {
  test("produces valid JSON", () => {
    const output = formatJson(makeReport());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test("contains expected top-level fields", () => {
    const output = formatJson(makeReport());
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("report-123");
    expect(parsed.timestamp).toBe("2025-01-15T10:30:00Z");
    expect(parsed.platform).toBe("openclaw");
    expect(parsed.skills).toBeArray();
    expect(parsed.summary).toBeDefined();
  });

  test("preserves summary fields", () => {
    const output = formatJson(makeReport());
    const parsed = JSON.parse(output);
    expect(parsed.summary.totalSkills).toBe(1);
    expect(parsed.summary.averageScore).toBe(72);
    expect(parsed.summary.certifiedSkills).toBe(1);
  });

  test("preserves skill findings", () => {
    const output = formatJson(makeReport());
    const parsed = JSON.parse(output);
    expect(parsed.skills[0].securityFindings).toHaveLength(1);
    expect(parsed.skills[0].securityFindings[0].rule).toBe("no-eval");
    expect(parsed.skills[0].securityFindings[0].severity).toBe("high");
  });

  test("handles empty findings", () => {
    const output = formatJson(makeEmptyReport());
    const parsed = JSON.parse(output);
    expect(parsed.skills[0].securityFindings).toHaveLength(0);
  });

  test("handles many findings", () => {
    const output = formatJson(makeReportWithManyFindings());
    const parsed = JSON.parse(output);
    expect(parsed.skills[0].securityFindings).toHaveLength(5);
  });

  test("output is pretty-printed with 2-space indentation", () => {
    const output = formatJson(makeReport());
    const lines = output.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toMatch(/^ {2}/);
  });
});

// ── SARIF formatter tests ───────────────────────────────────────────────── //

describe("formatSarif", () => {
  test("produces valid JSON", () => {
    const output = formatSarif(makeReport());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test("contains $schema field", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    expect(parsed.$schema).toContain("sarif-schema-2.1.0");
  });

  test("has version 2.1.0", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    expect(parsed.version).toBe("2.1.0");
  });

  test("has runs array with one run", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    expect(parsed.runs).toBeArray();
    expect(parsed.runs).toHaveLength(1);
  });

  test("run has results array", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].results).toBeArray();
    expect(parsed.runs[0].results).toHaveLength(1);
  });

  test("run has tool driver with rules", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    const driver = parsed.runs[0].tool.driver;
    expect(driver.name).toBe("Agent Audit");
    expect(driver.rules).toBeArray();
    expect(driver.rules).toHaveLength(1);
    expect(driver.rules[0].id).toBe("no-eval");
  });

  test("maps severity to SARIF levels correctly", () => {
    const report = makeReportWithManyFindings();
    const output = formatSarif(report);
    const parsed = JSON.parse(output);
    const results = parsed.runs[0].results;

    const criticalResult = results.find(
      (r: { properties: { severity: string } }) => r.properties.severity === "critical",
    );
    const highResult = results.find(
      (r: { properties: { severity: string } }) => r.properties.severity === "high",
    );
    const mediumResult = results.find(
      (r: { properties: { severity: string } }) => r.properties.severity === "medium",
    );
    const lowResult = results.find(
      (r: { properties: { severity: string } }) => r.properties.severity === "low",
    );
    const infoResult = results.find(
      (r: { properties: { severity: string } }) => r.properties.severity === "info",
    );

    expect(criticalResult.level).toBe("error");
    expect(highResult.level).toBe("error");
    expect(mediumResult.level).toBe("warning");
    expect(lowResult.level).toBe("note");
    expect(infoResult.level).toBe("note");
  });

  test("includes file locations when present", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    const result = parsed.runs[0].results[0];
    expect(result.locations).toBeArray();
    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe("index.ts");
    expect(result.locations[0].physicalLocation.region.startLine).toBe(42);
    expect(result.locations[0].physicalLocation.region.startColumn).toBe(5);
  });

  test("includes invocations with report metadata", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    const invocation = parsed.runs[0].invocations[0];
    expect(invocation.executionSuccessful).toBe(true);
    expect(invocation.startTimeUtc).toBe("2025-01-15T10:30:00Z");
    expect(invocation.properties.reportId).toBe("report-123");
  });

  test("includes automationDetails with report id", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].automationDetails.id).toBe("agentsec/report-123");
  });

  test("handles empty findings", () => {
    const output = formatSarif(makeEmptyReport());
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].results).toHaveLength(0);
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(0);
  });

  test("deduplicates rules across findings", () => {
    const report = makeReport({
      skills: [
        makeSkillResult({
          securityFindings: [
            makeFinding({ id: "f-1", rule: "no-eval", title: "First eval" }),
            makeFinding({ id: "f-2", rule: "no-eval", title: "Second eval" }),
            makeFinding({ id: "f-3", rule: "no-secrets", title: "Secret leak" }),
          ],
        }),
      ],
    });
    const output = formatSarif(report);
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(2);
    expect(parsed.runs[0].results).toHaveLength(3);
  });

  test("includes fingerprints with finding id", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    const result = parsed.runs[0].results[0];
    expect(result.fingerprints["agentsec/finding-id"]).toBe("finding-1");
  });

  test("includes security-severity in rule properties", () => {
    const output = formatSarif(makeReport());
    const parsed = JSON.parse(output);
    const rule = parsed.runs[0].tool.driver.rules[0];
    expect(rule.properties["security-severity"]).toBe("7.5");
  });

  test("omits location when file is missing", () => {
    const report = makeReport({
      skills: [
        makeSkillResult({
          securityFindings: [makeFinding({ file: undefined, line: undefined, column: undefined })],
        }),
      ],
    });
    const output = formatSarif(report);
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].results[0].locations).toBeUndefined();
  });
});

// ── HTML formatter tests ────────────────────────────────────────────────── //

describe("formatHtml", () => {
  test("starts with DOCTYPE", () => {
    const output = formatHtml(makeReport());
    expect(output).toStartWith("<!DOCTYPE html>");
  });

  test("contains html, head, and body tags", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("<html");
    expect(output).toContain("<head>");
    expect(output).toContain("<body>");
    expect(output).toContain("</html>");
  });

  test("contains title", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("<title>Agent Audit Report</title>");
  });

  test("contains header with Agent Audit", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("Agent Audit");
  });

  test("contains CSS with key classes", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain(".stat-card");
    expect(output).toContain(".gauge");
    expect(output).toContain(".skill-table");
    expect(output).toContain(".finding");
    expect(output).toContain(".severity-badge");
    expect(output).toContain(".grade-badge");
    expect(output).toContain(".metric-card");
  });

  test("contains dashboard stat cards", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("stat-card");
    expect(output).toContain("stat-value");
    expect(output).toContain("stat-label");
  });

  test("contains score gauge with average score", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("gauge-container");
    expect(output).toContain("gauge-score");
    expect(output).toContain("72");
  });

  test("contains skill table with scores", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("skill-table");
    expect(output).toContain("test-skill");
    expect(output).toContain("score-bar");
  });

  test("contains grade badges with correct classes", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("grade-badge");
    expect(output).toContain("grade-c");
  });

  test("contains finding cards", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("finding-header");
    expect(output).toContain("finding-title");
    expect(output).toContain("severity-high");
    expect(output).toContain("Eval usage detected");
  });

  test("contains quality metrics section", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("metric-card");
    expect(output).toContain("Quality Metrics");
  });

  test("contains JavaScript for toggle interaction", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("<script>");
    expect(output).toContain("finding-header");
  });

  test("contains footer with link", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("footer");
    expect(output).toContain("agent-audit"); // repo name in GitHub URL
  });

  test("contains report metadata", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("report-123");
    expect(output).toContain("openclaw");
  });

  test("escapes HTML entities in skill names", () => {
    const report = makeReport({
      skills: [
        makeSkillResult({
          skill: makeSkill({ name: '<script>alert("xss")</script>' }),
        }),
      ],
    });
    const output = formatHtml(report);
    expect(output).not.toContain('<script>alert("xss")</script>');
    expect(output).toContain("&lt;script&gt;");
  });

  test("shows no-findings message when empty", () => {
    const output = formatHtml(makeEmptyReport());
    expect(output).toContain("No security findings detected");
  });

  test("handles many findings with all severity levels", () => {
    const output = formatHtml(makeReportWithManyFindings());
    expect(output).toContain("severity-critical");
    expect(output).toContain("severity-high");
    expect(output).toContain("severity-medium");
    expect(output).toContain("severity-low");
    expect(output).toContain("severity-info");
  });

  test("renders policy violations when present", () => {
    const output = formatHtml(makeReportWithManyFindings());
    expect(output).toContain("Policy Violations");
    expect(output).toContain("no-critical-vulns");
  });

  test("renders recommendations when present", () => {
    const output = formatHtml(makeReportWithManyFindings());
    expect(output).toContain("Recommendations");
    expect(output).toContain("Fix eval");
    expect(output).toContain("effort-low");
  });

  test("omits policy violations section when none exist", () => {
    const output = formatHtml(makeEmptyReport());
    expect(output).not.toContain("Policy Violations");
  });

  test("renders remediation in finding body", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("finding-remediation");
    expect(output).toContain("Use a safe parser instead of eval()");
  });

  test("renders evidence in finding body", () => {
    const output = formatHtml(makeReport());
    expect(output).toContain("finding-evidence");
    expect(output).toContain("eval(userInput)");
  });
});

// ── Text formatter tests ────────────────────────────────────────────────── //

describe("formatText", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FORCE_COLOR: "1" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("produces non-empty output", () => {
    const output = formatText(makeReport());
    expect(output.length).toBeGreaterThan(0);
  });

  test("contains ANSI escape codes when color enabled", () => {
    const output = formatText(makeReport());
    expect(output).toMatch(/\x1b\[/);
  });

  test("contains Agent Audit banner", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("Agent Audit");
  });

  test("contains audit summary section", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("Audit Summary");
    expect(plain).toContain("Average Score");
  });

  test("contains skill scores section", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("Skill Scores");
    expect(plain).toContain("test-skill");
  });

  test("contains security findings section", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("Security Findings");
    expect(plain).toContain("Eval usage detected");
  });

  test("shows no-findings message when empty", () => {
    const output = formatText(makeEmptyReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("No security findings detected");
  });

  test("contains quality metrics section", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("Quality Metrics");
  });

  test("contains report footer with metadata", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("report-123");
  });

  test("renders policy violations when present", () => {
    const output = formatText(makeReportWithManyFindings());
    const plain = stripAnsi(output);
    expect(plain).toContain("Policy Violations");
    expect(plain).toContain("no-critical-vulns");
  });

  test("renders recommendations when present", () => {
    const output = formatText(makeReportWithManyFindings());
    const plain = stripAnsi(output);
    expect(plain).toContain("Recommendations");
    expect(plain).toContain("Fix eval");
  });

  test("renders finding evidence", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("eval(userInput)");
  });

  test("renders finding remediation", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("Use a safe parser instead of eval()");
  });

  test("renders file location for findings", () => {
    const output = formatText(makeReport());
    const plain = stripAnsi(output);
    expect(plain).toContain("index.ts:42:5");
  });
});

// ── Color utility tests ────────────────────────────────────────────────── //

describe("stripAnsi", () => {
  test("removes ANSI codes from styled text", () => {
    expect(stripAnsi("\x1b[1mhello\x1b[22m")).toBe("hello");
  });

  test("returns plain text unchanged", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });

  test("handles empty string", () => {
    expect(stripAnsi("")).toBe("");
  });

  test("removes multiple ANSI sequences", () => {
    expect(stripAnsi("\x1b[31m\x1b[1mred bold\x1b[22m\x1b[39m")).toBe("red bold");
  });
});

describe("visibleLength", () => {
  test("returns length of plain text", () => {
    expect(visibleLength("hello")).toBe(5);
  });

  test("ignores ANSI codes in length calculation", () => {
    expect(visibleLength("\x1b[31mhello\x1b[39m")).toBe(5);
  });

  test("returns 0 for empty string", () => {
    expect(visibleLength("")).toBe(0);
  });
});

describe("severityColor", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FORCE_COLOR: "1" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns a function for each severity", () => {
    const severities: Severity[] = ["critical", "high", "medium", "low", "info"];
    for (const sev of severities) {
      expect(typeof severityColor(sev)).toBe("function");
    }
  });

  test("critical uses bright red", () => {
    const colored = severityColor("critical")("test");
    expect(colored).toContain("\x1b[91m");
  });

  test("high uses yellow", () => {
    const colored = severityColor("high")("test");
    expect(colored).toContain("\x1b[33m");
  });

  test("low uses blue", () => {
    const colored = severityColor("low")("test");
    expect(colored).toContain("\x1b[34m");
  });

  test("info uses gray", () => {
    const colored = severityColor("info")("test");
    expect(colored).toContain("\x1b[90m");
  });
});

describe("gradeColor", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FORCE_COLOR: "1" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns a function for each grade", () => {
    const grades: AuditGrade[] = ["A", "B", "C", "D", "F"];
    for (const grade of grades) {
      expect(typeof gradeColor(grade)).toBe("function");
    }
  });

  test("grade A uses bright green", () => {
    const colored = gradeColor("A")("test");
    expect(colored).toContain("\x1b[92m");
  });

  test("grade C uses yellow", () => {
    const colored = gradeColor("C")("test");
    expect(colored).toContain("\x1b[33m");
  });

  test("grade F uses bright red", () => {
    const colored = gradeColor("F")("test");
    expect(colored).toContain("\x1b[91m");
  });
});

describe("progressBar", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FORCE_COLOR: "1" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("produces output with block characters", () => {
    const bar = progressBar(50, 100, 10);
    const plain = stripAnsi(bar);
    expect(plain.length).toBe(10);
  });

  test("full bar has all filled characters", () => {
    const bar = progressBar(100, 100, 10);
    const plain = stripAnsi(bar);
    expect(plain).toMatch(/\u2588{10}/);
  });

  test("empty bar has all empty characters", () => {
    const bar = progressBar(0, 100, 10);
    const plain = stripAnsi(bar);
    expect(plain).toMatch(/\u2591{10}/);
  });

  test("clamps value above max", () => {
    const bar = progressBar(200, 100, 10);
    const plain = stripAnsi(bar);
    expect(plain).toMatch(/\u2588{10}/);
  });

  test("clamps negative value to zero", () => {
    const bar = progressBar(-10, 100, 10);
    const plain = stripAnsi(bar);
    expect(plain).toMatch(/\u2591{10}/);
  });
});

describe("scoreGauge", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FORCE_COLOR: "1" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("includes score value", () => {
    const gauge = scoreGauge(72);
    const plain = stripAnsi(gauge);
    expect(plain).toContain("72");
  });

  test("includes /100 label", () => {
    const gauge = scoreGauge(72);
    const plain = stripAnsi(gauge);
    expect(plain).toContain("/100");
  });
});

describe("padEnd", () => {
  test("pads string to target width", () => {
    expect(padEnd("hi", 5)).toBe("hi   ");
  });

  test("does not truncate string longer than width", () => {
    expect(padEnd("hello world", 5)).toBe("hello world");
  });
});

describe("padStart", () => {
  test("pads string to target width on left", () => {
    expect(padStart("hi", 5)).toBe("   hi");
  });

  test("does not truncate string longer than width", () => {
    expect(padStart("hello world", 5)).toBe("hello world");
  });
});

describe("center", () => {
  test("centers string within width", () => {
    const centered = center("hi", 6);
    expect(centered).toBe("  hi  ");
  });

  test("handles odd padding", () => {
    const centered = center("hi", 7);
    expect(centered.length).toBe(7);
    expect(centered.trim()).toBe("hi");
  });

  test("does not truncate string longer than width", () => {
    expect(center("hello world", 5)).toBe("hello world");
  });
});

describe("symbols", () => {
  test("has expected symbols defined", () => {
    expect(symbols.check).toBeDefined();
    expect(symbols.cross).toBeDefined();
    expect(symbols.warning).toBeDefined();
    expect(symbols.info).toBeDefined();
    expect(symbols.bullet).toBeDefined();
  });
});

describe("box", () => {
  test("has expected box drawing characters", () => {
    expect(box.topLeft).toBeDefined();
    expect(box.topRight).toBeDefined();
    expect(box.bottomLeft).toBeDefined();
    expect(box.bottomRight).toBeDefined();
    expect(box.horizontal).toBeDefined();
    expect(box.vertical).toBeDefined();
  });
});

describe("color functions with FORCE_COLOR", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FORCE_COLOR: "1" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("bold wraps text with ANSI bold codes", () => {
    const result = bold("test");
    expect(result).toContain("\x1b[1m");
    expect(result).toContain("\x1b[22m");
    expect(result).toContain("test");
  });

  test("red wraps text with red color codes", () => {
    const result = red("test");
    expect(result).toContain("\x1b[31m");
    expect(result).toContain("\x1b[39m");
  });

  test("green wraps text with green color codes", () => {
    const result = green("test");
    expect(result).toContain("\x1b[32m");
  });

  test("dim wraps text with dim codes", () => {
    const result = dim("test");
    expect(result).toContain("\x1b[2m");
  });
});

describe("NO_COLOR environment variable", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns plain text when NO_COLOR is set", () => {
    process.env = { ...originalEnv, NO_COLOR: "1" };
    // Need to re-evaluate: the wrap function checks env at call time
    const result = bold("test");
    expect(result).toBe("test");
  });
});
