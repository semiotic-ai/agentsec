import { describe, expect, it } from "bun:test";
import type { PolicyConfig, PolicyViolation } from "@agentsec/shared";
import { PolicyEngine } from "../engine";
import { makeAuditResult } from "./helpers";

// ---------------------------------------------------------------------------
// loadPolicy
// ---------------------------------------------------------------------------

describe("PolicyEngine.loadPolicy", () => {
  it("loads the strict preset by name", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const policy = engine.getPolicy();
    expect(policy).not.toBeNull();
    expect(policy?.name).toBe("strict");
  });

  it("loads the standard preset by name", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("standard");
    expect(engine.getPolicy()?.name).toBe("standard");
  });

  it("loads the permissive preset by name", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("permissive");
    expect(engine.getPolicy()?.name).toBe("permissive");
  });

  it("loads the enterprise preset by name", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("enterprise");
    expect(engine.getPolicy()?.name).toBe("enterprise");
  });

  it("throws for an unknown preset name", () => {
    const engine = new PolicyEngine();
    expect(() => engine.loadPolicy("nonexistent")).toThrow("Unknown policy preset");
  });

  it("loads a custom PolicyConfig object", () => {
    const engine = new PolicyEngine();
    const custom: PolicyConfig = {
      name: "custom-policy",
      rules: [
        {
          id: "custom-rule-1",
          description: "Block low scores",
          severity: "high",
          action: "block",
          condition: {
            type: "score-below",
            value: { threshold: 90 },
          },
        },
      ],
    };
    engine.loadPolicy(custom);
    const policy = engine.getPolicy();
    expect(policy?.name).toBe("custom-policy");
    expect(policy?.rules).toHaveLength(1);
  });

  it("replaces a previously loaded policy", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    expect(engine.getPolicy()?.name).toBe("strict");
    engine.loadPolicy("permissive");
    expect(engine.getPolicy()?.name).toBe("permissive");
  });
});

// ---------------------------------------------------------------------------
// getPolicy
// ---------------------------------------------------------------------------

describe("PolicyEngine.getPolicy", () => {
  it("returns null when no policy is loaded", () => {
    const engine = new PolicyEngine();
    expect(engine.getPolicy()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate
// ---------------------------------------------------------------------------

describe("PolicyEngine.evaluate", () => {
  it("throws when no policy is loaded", () => {
    const engine = new PolicyEngine();
    const result = makeAuditResult();
    expect(() => engine.evaluate(result)).toThrow("No policy loaded");
  });

  it("returns empty violations for a clean skill with strict policy", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const result = makeAuditResult({
      score: { overall: 95, security: 95, quality: 90, maintenance: 90, grade: "A" },
      securityFindings: [],
    });
    const violations = engine.evaluate(result);
    expect(violations).toHaveLength(0);
  });

  it("returns block violations for critical findings under strict", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const result = makeAuditResult({
      securityFindings: [
        {
          id: "f1",
          rule: "test",
          severity: "critical",
          category: "skill-injection",
          title: "Injection",
          description: "Found injection",
        },
      ],
    });
    const violations = engine.evaluate(result);
    const blockViolations = violations.filter((v) => v.action === "block");
    expect(blockViolations.length).toBeGreaterThan(0);
  });

  it("returns warn violations for medium findings under strict", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const result = makeAuditResult({
      score: { overall: 90, security: 90, quality: 90, maintenance: 90, grade: "A" },
      securityFindings: [
        {
          id: "f1",
          rule: "test",
          severity: "medium",
          category: "insecure-output",
          title: "Medium issue",
          description: "A medium issue",
        },
      ],
    });
    const violations = engine.evaluate(result);
    const warnViolations = violations.filter((v) => v.action === "warn");
    expect(warnViolations.length).toBeGreaterThan(0);
  });

  it("blocks on low score under standard policy", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("standard");
    const result = makeAuditResult({
      score: { overall: 50, security: 50, quality: 50, maintenance: 50, grade: "D" },
      securityFindings: [],
    });
    const violations = engine.evaluate(result);
    const blockViolations = violations.filter((v) => v.action === "block");
    expect(blockViolations.length).toBeGreaterThan(0);
  });

  it("returns info violations for medium findings under standard", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("standard");
    const result = makeAuditResult({
      score: { overall: 80, security: 80, quality: 80, maintenance: 80, grade: "B" },
      securityFindings: [
        {
          id: "f1",
          rule: "test",
          severity: "medium",
          category: "insecure-output",
          title: "Medium issue",
          description: "A medium issue",
        },
      ],
    });
    const violations = engine.evaluate(result);
    const infoViolations = violations.filter((v) => v.action === "info");
    expect(infoViolations.length).toBeGreaterThan(0);
  });

  it("permissive only blocks critical findings with CVE", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("permissive");

    // Critical without CVE should not block
    const resultNoCve = makeAuditResult({
      securityFindings: [
        {
          id: "f1",
          rule: "test",
          severity: "critical",
          category: "skill-injection",
          title: "Critical",
          description: "No CVE",
        },
      ],
    });
    const violationsNoCve = engine.evaluate(resultNoCve);
    const blocksNoCve = violationsNoCve.filter((v) => v.action === "block");
    expect(blocksNoCve).toHaveLength(0);

    // Critical with CVE should block
    const resultWithCve = makeAuditResult({
      securityFindings: [
        {
          id: "f1",
          rule: "test",
          severity: "critical",
          category: "dependency-vulnerability",
          title: "Critical CVE",
          description: "Has CVE",
          cve: "CVE-2024-9999",
        },
      ],
    });
    const violationsWithCve = engine.evaluate(resultWithCve);
    const blocksWithCve = violationsWithCve.filter((v) => v.action === "block");
    expect(blocksWithCve.length).toBeGreaterThan(0);
  });

  it("produces a violation message combining rule description and reason", () => {
    const engine = new PolicyEngine();
    const custom: PolicyConfig = {
      name: "msg-test",
      rules: [
        {
          id: "msg-rule",
          description: "Score too low",
          severity: "high",
          action: "block",
          condition: { type: "score-below", value: { threshold: 90 } },
        },
      ],
    };
    engine.loadPolicy(custom);
    const result = makeAuditResult({
      score: { overall: 50, security: 50, quality: 50, maintenance: 50, grade: "D" },
    });
    const violations = engine.evaluate(result);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("Score too low");
    expect(violations[0].policy).toBe("msg-rule");
    expect(violations[0].severity).toBe("high");
    expect(violations[0].action).toBe("block");
  });

  it("returns empty violations when no findings and score is high", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const result = makeAuditResult({
      score: { overall: 100, security: 100, quality: 100, maintenance: 100, grade: "A" },
      securityFindings: [],
    });
    const violations = engine.evaluate(result);
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// shouldBlock
// ---------------------------------------------------------------------------

describe("PolicyEngine.shouldBlock", () => {
  const engine = new PolicyEngine();

  it("returns true when any violation has action block", () => {
    const violations: PolicyViolation[] = [
      { policy: "r1", severity: "high", message: "blocked", action: "block" },
      { policy: "r2", severity: "medium", message: "warned", action: "warn" },
    ];
    expect(engine.shouldBlock(violations)).toBe(true);
  });

  it("returns false when no violation has action block", () => {
    const violations: PolicyViolation[] = [
      { policy: "r1", severity: "medium", message: "warned", action: "warn" },
      { policy: "r2", severity: "low", message: "info", action: "info" },
    ];
    expect(engine.shouldBlock(violations)).toBe(false);
  });

  it("returns false for empty violations", () => {
    expect(engine.shouldBlock([])).toBe(false);
  });

  it("returns true when all violations are blocks", () => {
    const violations: PolicyViolation[] = [
      { policy: "r1", severity: "critical", message: "b1", action: "block" },
      { policy: "r2", severity: "high", message: "b2", action: "block" },
    ];
    expect(engine.shouldBlock(violations)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

describe("PolicyEngine.check", () => {
  it("returns blocked=true with summary when skill is blocked", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const result = makeAuditResult({
      score: { overall: 40, security: 40, quality: 40, maintenance: 40, grade: "F" },
      securityFindings: [
        {
          id: "f1",
          rule: "test",
          severity: "critical",
          category: "skill-injection",
          title: "Critical",
          description: "Critical issue",
        },
      ],
    });
    const checkResult = engine.check(result);
    expect(checkResult.blocked).toBe(true);
    expect(checkResult.blocks.length).toBeGreaterThan(0);
    expect(checkResult.summary).toContain("blocked");
  });

  it("returns blocked=false with warnings summary", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const result = makeAuditResult({
      score: { overall: 90, security: 90, quality: 90, maintenance: 90, grade: "A" },
      securityFindings: [
        {
          id: "f1",
          rule: "test",
          severity: "medium",
          category: "insecure-output",
          title: "Medium",
          description: "Medium issue",
        },
      ],
    });
    const checkResult = engine.check(result);
    expect(checkResult.blocked).toBe(false);
    expect(checkResult.warnings.length).toBeGreaterThan(0);
    expect(checkResult.summary).toContain("warning");
  });

  it("returns passed summary with no violations", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const result = makeAuditResult({
      score: { overall: 95, security: 95, quality: 95, maintenance: 95, grade: "A" },
      securityFindings: [],
    });
    const checkResult = engine.check(result);
    expect(checkResult.blocked).toBe(false);
    expect(checkResult.violations).toHaveLength(0);
    expect(checkResult.blocks).toHaveLength(0);
    expect(checkResult.warnings).toHaveLength(0);
    expect(checkResult.infos).toHaveLength(0);
    expect(checkResult.summary).toContain("passed all policy checks");
  });

  it("categorizes violations into blocks, warnings, and infos", () => {
    const engine = new PolicyEngine();
    const custom: PolicyConfig = {
      name: "mixed-policy",
      rules: [
        {
          id: "r-block",
          description: "Block rule",
          severity: "critical",
          action: "block",
          condition: { type: "score-below", value: { threshold: 100 } },
        },
        {
          id: "r-warn",
          description: "Warn rule",
          severity: "medium",
          action: "warn",
          condition: { type: "score-below", value: { threshold: 100 } },
        },
        {
          id: "r-info",
          description: "Info rule",
          severity: "low",
          action: "info",
          condition: { type: "score-below", value: { threshold: 100 } },
        },
      ],
    };
    engine.loadPolicy(custom);
    const result = makeAuditResult({
      score: { overall: 50, security: 50, quality: 50, maintenance: 50, grade: "D" },
    });
    const checkResult = engine.check(result);
    expect(checkResult.blocked).toBe(true);
    expect(checkResult.blocks).toHaveLength(1);
    expect(checkResult.warnings).toHaveLength(1);
    expect(checkResult.infos).toHaveLength(1);
    expect(checkResult.violations).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Preset content verification
// ---------------------------------------------------------------------------

describe("Preset rules content", () => {
  it("strict preset has rules for critical, high, score, and medium", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("strict");
    const policy = engine.getPolicy() as PolicyConfig;
    const ruleIds = policy.rules.map((r) => r.id);
    expect(ruleIds).toContain("strict-critical-findings");
    expect(ruleIds).toContain("strict-high-findings");
    expect(ruleIds).toContain("strict-score-minimum");
    expect(ruleIds).toContain("strict-medium-findings");
  });

  it("standard preset has rules for critical, high, score, and medium", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("standard");
    const policy = engine.getPolicy() as PolicyConfig;
    const ruleIds = policy.rules.map((r) => r.id);
    expect(ruleIds).toContain("standard-critical-findings");
    expect(ruleIds).toContain("standard-high-findings");
    expect(ruleIds).toContain("standard-score-minimum");
    expect(ruleIds).toContain("standard-medium-findings");
  });

  it("permissive preset only has two rules", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("permissive");
    const policy = engine.getPolicy() as PolicyConfig;
    expect(policy.rules).toHaveLength(2);
  });

  it("enterprise preset includes strict rules plus extra requirements", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("enterprise");
    const policy = engine.getPolicy() as PolicyConfig;
    const ruleIds = policy.rules.map((r) => r.id);
    expect(ruleIds).toContain("enterprise-critical-findings");
    expect(ruleIds).toContain("enterprise-requires-license");
    expect(ruleIds).toContain("enterprise-requires-types");
    expect(ruleIds).toContain("enterprise-requires-tests");
    expect(ruleIds).toContain("enterprise-security-score");
  });

  it("enterprise preset blocks skills without a license", () => {
    const engine = new PolicyEngine();
    engine.loadPolicy("enterprise");
    const result = makeAuditResult({
      score: { overall: 95, security: 95, quality: 95, maintenance: 95, grade: "A" },
      qualityMetrics: {
        codeComplexity: 5,
        testCoverage: 80,
        documentationScore: 60,
        maintenanceHealth: 70,
        dependencyCount: 3,
        outdatedDependencies: 0,
        hasReadme: true,
        hasLicense: false,
        hasTests: true,
        hasTypes: true,
        linesOfCode: 200,
      },
    });
    const violations = engine.evaluate(result);
    const licenseBlocks = violations.filter(
      (v) => v.policy === "enterprise-requires-license" && v.action === "block",
    );
    expect(licenseBlocks).toHaveLength(1);
  });
});
