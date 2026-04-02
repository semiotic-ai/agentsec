import { describe, expect, it } from "bun:test";
import { evaluateCondition } from "../conditions";
import type { PolicyCondition } from "@agent-audit/shared";
import { makeAuditResult, makeAuditResultWithManifest } from "./helpers";

// ---------------------------------------------------------------------------
// score-below
// ---------------------------------------------------------------------------

describe("evaluateCondition: score-below", () => {
  it("fires when overall score is below threshold", () => {
    const result = makeAuditResult({
      score: { overall: 50, security: 80, quality: 70, maintenance: 65, grade: "C" },
    });
    const condition: PolicyCondition = {
      type: "score-below",
      value: { threshold: 60 },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("50");
    expect(out.reason).toContain("60");
  });

  it("does not fire when score meets threshold", () => {
    const result = makeAuditResult({
      score: { overall: 80, security: 80, quality: 70, maintenance: 65, grade: "B" },
    });
    const condition: PolicyCondition = {
      type: "score-below",
      value: { threshold: 80 },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });

  it("defaults to overall when field is not specified", () => {
    const result = makeAuditResult({
      score: { overall: 55, security: 90, quality: 90, maintenance: 90, grade: "C" },
    });
    const condition: PolicyCondition = {
      type: "score-below",
      value: { threshold: 60 },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("overall");
  });

  it("checks the security field when specified", () => {
    const result = makeAuditResult({
      score: { overall: 90, security: 40, quality: 90, maintenance: 90, grade: "A" },
    });
    const condition: PolicyCondition = {
      type: "score-below",
      value: { field: "security", threshold: 50 },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("security");
  });

  it("checks the quality field when specified", () => {
    const result = makeAuditResult({
      score: { overall: 90, security: 90, quality: 30, maintenance: 90, grade: "A" },
    });
    const condition: PolicyCondition = {
      type: "score-below",
      value: { field: "quality", threshold: 50 },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("quality");
  });

  it("checks the maintenance field when specified", () => {
    const result = makeAuditResult({
      score: { overall: 90, security: 90, quality: 90, maintenance: 20, grade: "A" },
    });
    const condition: PolicyCondition = {
      type: "score-below",
      value: { field: "maintenance", threshold: 50 },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("maintenance");
  });

  it("returns not-met for invalid threshold", () => {
    const result = makeAuditResult();
    const condition: PolicyCondition = {
      type: "score-below",
      value: { threshold: -5 },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
    expect(out.reason).toContain("Invalid");
  });

  it("returns not-met for threshold above 100", () => {
    const result = makeAuditResult();
    const condition: PolicyCondition = {
      type: "score-below",
      value: { threshold: 150 },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// finding-exists
// ---------------------------------------------------------------------------

describe("evaluateCondition: finding-exists", () => {
  it("fires when a critical finding exists", () => {
    const result = makeAuditResult({
      securityFindings: [
        {
          id: "f1",
          rule: "test-rule",
          severity: "critical",
          category: "skill-injection",
          title: "Critical Issue",
          description: "A critical issue",
        },
      ],
    });
    const condition: PolicyCondition = {
      type: "finding-exists",
      value: { severity: ["critical"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("1 matching");
  });

  it("does not fire when no findings match the severity filter", () => {
    const result = makeAuditResult({
      securityFindings: [
        {
          id: "f1",
          rule: "test-rule",
          severity: "low",
          category: "skill-injection",
          title: "Low Issue",
          description: "A low issue",
        },
      ],
    });
    const condition: PolicyCondition = {
      type: "finding-exists",
      value: { severity: ["critical", "high"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });

  it("filters by OWASP category", () => {
    const result = makeAuditResult({
      securityFindings: [
        {
          id: "f1",
          rule: "test-rule",
          severity: "high",
          category: "supply-chain",
          title: "Supply chain",
          description: "Supply chain issue",
        },
        {
          id: "f2",
          rule: "test-rule",
          severity: "high",
          category: "skill-injection",
          title: "Injection",
          description: "Injection issue",
        },
      ],
    });
    const condition: PolicyCondition = {
      type: "finding-exists",
      value: { category: ["supply-chain"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("1 matching");
    expect(out.reason).toContain("supply-chain");
  });

  it("filters by withCve flag", () => {
    const result = makeAuditResult({
      securityFindings: [
        {
          id: "f1",
          rule: "test-rule",
          severity: "critical",
          category: "dependency-vulnerability",
          title: "CVE issue",
          description: "Has CVE",
          cve: "CVE-2024-1234",
        },
        {
          id: "f2",
          rule: "test-rule",
          severity: "critical",
          category: "skill-injection",
          title: "No CVE",
          description: "No CVE",
        },
      ],
    });
    const condition: PolicyCondition = {
      type: "finding-exists",
      value: { severity: ["critical"], withCve: true },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("1 matching");
  });

  it("matches all findings when no filters are specified", () => {
    const result = makeAuditResult({
      securityFindings: [
        {
          id: "f1",
          rule: "r1",
          severity: "low",
          category: "skill-injection",
          title: "t1",
          description: "d1",
        },
        {
          id: "f2",
          rule: "r2",
          severity: "info",
          category: "insecure-output",
          title: "t2",
          description: "d2",
        },
      ],
    });
    const condition: PolicyCondition = {
      type: "finding-exists",
      value: {},
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("2 matching");
  });

  it("does not fire when findings list is empty", () => {
    const result = makeAuditResult({ securityFindings: [] });
    const condition: PolicyCondition = {
      type: "finding-exists",
      value: {},
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });

  it("truncates reason to 3 findings with extra count", () => {
    const findings = Array.from({ length: 5 }, (_, i) => ({
      id: `f${i}`,
      rule: `r${i}`,
      severity: "medium" as const,
      category: "skill-injection" as const,
      title: `t${i}`,
      description: `d${i}`,
    }));
    const result = makeAuditResult({ securityFindings: findings });
    const condition: PolicyCondition = {
      type: "finding-exists",
      value: { severity: ["medium"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("5 matching");
    expect(out.reason).toContain("and 2 more");
  });
});

// ---------------------------------------------------------------------------
// permission-used
// ---------------------------------------------------------------------------

describe("evaluateCondition: permission-used", () => {
  it("fires when a banned permission is used", () => {
    const result = makeAuditResultWithManifest({
      permissions: ["fs:write", "net:outbound", "env:read"],
    });
    const condition: PolicyCondition = {
      type: "permission-used",
      value: { banned: ["net:outbound"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("net:outbound");
  });

  it("does not fire when no banned permissions are used", () => {
    const result = makeAuditResultWithManifest({
      permissions: ["fs:read"],
    });
    const condition: PolicyCondition = {
      type: "permission-used",
      value: { banned: ["net:outbound", "env:write"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });

  it("handles skills with no permissions declared", () => {
    const result = makeAuditResultWithManifest({});
    const condition: PolicyCondition = {
      type: "permission-used",
      value: { banned: ["net:outbound"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });

  it("reports multiple banned permissions", () => {
    const result = makeAuditResultWithManifest({
      permissions: ["fs:write", "net:outbound", "env:write"],
    });
    const condition: PolicyCondition = {
      type: "permission-used",
      value: { banned: ["net:outbound", "env:write"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("net:outbound");
    expect(out.reason).toContain("env:write");
  });
});

// ---------------------------------------------------------------------------
// dependency-banned
// ---------------------------------------------------------------------------

describe("evaluateCondition: dependency-banned", () => {
  it("fires when a banned dependency is used", () => {
    const result = makeAuditResultWithManifest({
      dependencies: { lodash: "4.17.21", axios: "1.6.0" },
    });
    const condition: PolicyCondition = {
      type: "dependency-banned",
      value: { banned: ["axios"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("axios");
  });

  it("does not fire when no banned dependencies are present", () => {
    const result = makeAuditResultWithManifest({
      dependencies: { lodash: "4.17.21" },
    });
    const condition: PolicyCondition = {
      type: "dependency-banned",
      value: { banned: ["axios", "request"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });

  it("handles skills with no dependencies", () => {
    const result = makeAuditResultWithManifest({});
    const condition: PolicyCondition = {
      type: "dependency-banned",
      value: { banned: ["malware-pkg"] },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// custom
// ---------------------------------------------------------------------------

describe("evaluateCondition: custom", () => {
  it("evaluates a true expression", () => {
    const result = makeAuditResult({
      qualityMetrics: {
        codeComplexity: 5,
        testCoverage: 30,
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
    const condition: PolicyCondition = {
      type: "custom",
      value: {
        expression: "!result.qualityMetrics.hasLicense",
        label: "Skill must have a license",
      },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(true);
    expect(out.reason).toContain("Skill must have a license");
  });

  it("evaluates a false expression", () => {
    const result = makeAuditResult();
    const condition: PolicyCondition = {
      type: "custom",
      value: {
        expression: "!result.qualityMetrics.hasLicense",
        label: "Skill must have a license",
      },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
  });

  it("handles invalid expressions gracefully", () => {
    const result = makeAuditResult();
    const condition: PolicyCondition = {
      type: "custom",
      value: { expression: "this is not valid js{{{" },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
    expect(out.reason).toContain("error");
  });

  it("handles empty expression", () => {
    const result = makeAuditResult();
    const condition: PolicyCondition = {
      type: "custom",
      value: { expression: "" },
    };
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
    expect(out.reason).toContain("Invalid");
  });
});

// ---------------------------------------------------------------------------
// Unknown condition type
// ---------------------------------------------------------------------------

describe("evaluateCondition: unknown type", () => {
  it("returns not-met for an unknown condition type", () => {
    const result = makeAuditResult();
    const condition = {
      type: "nonexistent-type",
      value: {},
    } as unknown as PolicyCondition;
    const out = evaluateCondition(condition, result);
    expect(out.met).toBe(false);
    expect(out.reason).toContain("Unknown condition type");
  });
});
