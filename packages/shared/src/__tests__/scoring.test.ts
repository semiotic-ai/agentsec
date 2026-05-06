import { describe, expect, it } from "bun:test";
import {
  buildAuditScore,
  calculateOverallScore,
  calculateQualityScore,
  calculateSecurityScore,
  scoreToGrade,
} from "../scoring";
import type { QualityMetrics, SecurityFinding } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(severity: SecurityFinding["severity"], id = "f1"): SecurityFinding {
  return {
    id,
    rule: "test-rule",
    severity,
    category: "skill-injection",
    title: "Test finding",
    description: "A test finding",
  };
}

function makeMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    codeComplexity: 5,
    testCoverage: 80,
    documentationScore: 0.8,
    maintenanceHealth: 0.7,
    dependencyCount: 10,
    outdatedDependencies: 0,
    hasReadme: true,
    hasLicense: true,
    hasTests: true,
    hasTypes: true,
    linesOfCode: 500,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateSecurityScore
// ---------------------------------------------------------------------------

describe("calculateSecurityScore", () => {
  it("returns 100 when there are zero findings", () => {
    expect(calculateSecurityScore([])).toBe(100);
  });

  it("reduces score significantly for a critical finding", () => {
    const score = calculateSecurityScore([makeFinding("critical")]);
    // critical weight = 10, penalty = 10 * 3 = 30 => score = 70
    expect(score).toBe(70);
    expect(score).toBeLessThanOrEqual(75);
  });

  it("reduces score for a high severity finding", () => {
    const score = calculateSecurityScore([makeFinding("high")]);
    // high weight = 7, penalty = 7 * 3 = 21 => score = 79
    expect(score).toBe(79);
  });

  it("reduces score moderately for a medium finding", () => {
    const score = calculateSecurityScore([makeFinding("medium")]);
    // medium weight = 4, penalty = 4 * 3 = 12 => score = 88
    expect(score).toBe(88);
  });

  it("reduces score slightly for a low finding", () => {
    const score = calculateSecurityScore([makeFinding("low")]);
    // low weight = 2, penalty = 2 * 3 = 6 => score = 94
    expect(score).toBe(94);
  });

  it("does not reduce score for an info finding", () => {
    const score = calculateSecurityScore([makeFinding("info")]);
    // info weight = 0, penalty = 0 => score = 100
    expect(score).toBe(100);
  });

  it("accumulates penalties from multiple findings", () => {
    const findings = [
      makeFinding("critical", "f1"),
      makeFinding("high", "f2"),
      makeFinding("medium", "f3"),
    ];
    // penalty = (10+7+4)*3 = 63 => score = 37
    const score = calculateSecurityScore(findings);
    expect(score).toBe(37);
  });

  it("clamps score to 0 when penalties exceed 100", () => {
    const findings = [
      makeFinding("critical", "f1"),
      makeFinding("critical", "f2"),
      makeFinding("critical", "f3"),
      makeFinding("critical", "f4"),
    ];
    // penalty = 4 * 30 = 120, clamped to 0
    const score = calculateSecurityScore(findings);
    expect(score).toBe(0);
  });

  it("never returns a value above 100", () => {
    const score = calculateSecurityScore([]);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("never returns a negative value", () => {
    const many = Array.from({ length: 20 }, (_, i) => makeFinding("critical", `f${i}`));
    expect(calculateSecurityScore(many)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// calculateQualityScore
// ---------------------------------------------------------------------------

describe("calculateQualityScore", () => {
  it("returns a high score when all metrics are good", () => {
    const metrics = makeMetrics({
      codeComplexity: 0,
      documentationScore: 1.0,
      hasTests: true,
      testCoverage: 100,
      hasTypes: true,
      hasReadme: true,
      hasLicense: true,
      outdatedDependencies: 0,
    });
    const score = calculateQualityScore(metrics);
    // base 50 + 15 + 10 + 5 + 10 + 5 + 3 + 2 - 0 = 100
    expect(score).toBe(100);
  });

  it("starts from a base of 50 with neutral metrics", () => {
    const metrics = makeMetrics({
      codeComplexity: 15, // gives 0 bonus (max(0, 15-15)=0)
      documentationScore: 0,
      hasTests: false,
      testCoverage: null,
      hasTypes: false,
      hasReadme: false,
      hasLicense: false,
      outdatedDependencies: 0,
    });
    const score = calculateQualityScore(metrics);
    expect(score).toBe(50);
  });

  it("penalizes outdated dependencies", () => {
    const base = makeMetrics({ outdatedDependencies: 0 });
    const outdated = makeMetrics({ outdatedDependencies: 3 });
    const baseScore = calculateQualityScore(base);
    const outdatedScore = calculateQualityScore(outdated);
    expect(outdatedScore).toBeLessThan(baseScore);
    expect(baseScore - outdatedScore).toBe(6); // 3 * 2 = 6
  });

  it("caps outdated dependency penalty at 10", () => {
    const manyOutdated = makeMetrics({ outdatedDependencies: 20 });
    const fiveOutdated = makeMetrics({ outdatedDependencies: 5 });
    // 20*2=40, capped at 10 vs 5*2=10, capped at 10 => same penalty
    expect(calculateQualityScore(manyOutdated)).toBe(calculateQualityScore(fiveOutdated));
  });

  it("adds test coverage bonus proportionally", () => {
    const withCoverage = makeMetrics({ testCoverage: 50, hasTests: true });
    const noCoverage = makeMetrics({ testCoverage: null, hasTests: true });
    const diff = calculateQualityScore(withCoverage) - calculateQualityScore(noCoverage);
    // (50/100)*10 = 5
    expect(diff).toBe(5);
  });

  it("clamps score to 0 minimum", () => {
    // Even with terrible metrics, score should not go below 0
    const terrible = makeMetrics({
      codeComplexity: 100,
      documentationScore: 0,
      hasTests: false,
      testCoverage: null,
      hasTypes: false,
      hasReadme: false,
      hasLicense: false,
      outdatedDependencies: 50,
    });
    expect(calculateQualityScore(terrible)).toBeGreaterThanOrEqual(0);
  });

  it("clamps score to 100 maximum", () => {
    const perfect = makeMetrics({
      codeComplexity: 0,
      documentationScore: 1.0,
      hasTests: true,
      testCoverage: 100,
      hasTypes: true,
      hasReadme: true,
      hasLicense: true,
      outdatedDependencies: 0,
    });
    expect(calculateQualityScore(perfect)).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// calculateOverallScore
// ---------------------------------------------------------------------------

describe("calculateOverallScore", () => {
  it("applies correct weighting: 50% security, 30% quality, 20% maintenance", () => {
    // All 100 => 100
    expect(calculateOverallScore(100, 100, 100)).toBe(100);
  });

  it("weights security at 50%", () => {
    // security=0, quality=100, quality=100 => 0 + 30 + 20 = 50
    expect(calculateOverallScore(0, 100, 100)).toBe(50);
  });

  it("weights quality at 30%", () => {
    // security=100, quality=0, maintenance=100 => 50 + 0 + 20 = 70
    expect(calculateOverallScore(100, 0, 100)).toBe(70);
  });

  it("weights maintenance at 20%", () => {
    // security=100, quality=100, maintenance=0 => 50 + 30 + 0 = 80
    expect(calculateOverallScore(100, 100, 0)).toBe(80);
  });

  it("returns 0 when all inputs are 0", () => {
    expect(calculateOverallScore(0, 0, 0)).toBe(0);
  });

  it("rounds to the nearest integer", () => {
    // 33*0.5 + 33*0.3 + 33*0.2 = 16.5+9.9+6.6 = 33
    expect(calculateOverallScore(33, 33, 33)).toBe(33);
    // 77*0.5 + 55*0.3 + 88*0.2 = 38.5 + 16.5 + 17.6 = 72.6 => 73
    expect(calculateOverallScore(77, 55, 88)).toBe(73);
  });
});

// ---------------------------------------------------------------------------
// scoreToGrade
// ---------------------------------------------------------------------------

describe("scoreToGrade", () => {
  it("returns A for score >= 90", () => {
    expect(scoreToGrade(90)).toBe("A");
    expect(scoreToGrade(95)).toBe("A");
    expect(scoreToGrade(100)).toBe("A");
  });

  it("returns B for score >= 75 and < 90", () => {
    expect(scoreToGrade(75)).toBe("B");
    expect(scoreToGrade(80)).toBe("B");
    expect(scoreToGrade(89)).toBe("B");
  });

  it("returns C for score >= 60 and < 75", () => {
    expect(scoreToGrade(60)).toBe("C");
    expect(scoreToGrade(67)).toBe("C");
    expect(scoreToGrade(74)).toBe("C");
  });

  it("returns D for score >= 40 and < 60", () => {
    expect(scoreToGrade(40)).toBe("D");
    expect(scoreToGrade(50)).toBe("D");
    expect(scoreToGrade(59)).toBe("D");
  });

  it("returns F for score < 40", () => {
    expect(scoreToGrade(0)).toBe("F");
    expect(scoreToGrade(20)).toBe("F");
    expect(scoreToGrade(39)).toBe("F");
  });

  it("handles exact boundary values correctly", () => {
    expect(scoreToGrade(90)).toBe("A");
    expect(scoreToGrade(89)).toBe("B");
    expect(scoreToGrade(75)).toBe("B");
    expect(scoreToGrade(74)).toBe("C");
    expect(scoreToGrade(60)).toBe("C");
    expect(scoreToGrade(59)).toBe("D");
    expect(scoreToGrade(40)).toBe("D");
    expect(scoreToGrade(39)).toBe("F");
  });
});

// ---------------------------------------------------------------------------
// buildAuditScore (integration)
// ---------------------------------------------------------------------------

describe("buildAuditScore", () => {
  it("composes all scoring functions into an AuditScore", () => {
    const findings: SecurityFinding[] = [];
    const metrics = makeMetrics();
    const maintenanceScore = 85;

    const result = buildAuditScore(findings, metrics, maintenanceScore);

    expect(result).toHaveProperty("overall");
    expect(result).toHaveProperty("security");
    expect(result).toHaveProperty("quality");
    expect(result).toHaveProperty("maintenance");
    expect(result).toHaveProperty("grade");
  });

  it("returns perfect score with no findings and good metrics", () => {
    const findings: SecurityFinding[] = [];
    const metrics = makeMetrics({
      codeComplexity: 0,
      documentationScore: 1.0,
      hasTests: true,
      testCoverage: 100,
      hasTypes: true,
      hasReadme: true,
      hasLicense: true,
      outdatedDependencies: 0,
    });

    const result = buildAuditScore(findings, metrics, 100);
    expect(result.security).toBe(100);
    expect(result.quality).toBe(100);
    expect(result.maintenance).toBe(100);
    expect(result.overall).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("passes maintenance score through unchanged", () => {
    const result = buildAuditScore([], makeMetrics(), 42);
    expect(result.maintenance).toBe(42);
  });

  it("produces a low grade when critical findings are present", () => {
    const findings = [makeFinding("critical", "f1"), makeFinding("critical", "f2")];
    const metrics = makeMetrics({
      codeComplexity: 15,
      documentationScore: 0,
      hasTests: false,
      testCoverage: null,
      hasTypes: false,
      hasReadme: false,
      hasLicense: false,
      outdatedDependencies: 5,
    });

    const result = buildAuditScore(findings, metrics, 30);

    expect(result.security).toBe(40);
    expect(result.grade).toBe("F");
    expect(result.overall).toBeLessThan(40);
  });

  it("computes overall as the weighted sum of sub-scores", () => {
    const result = buildAuditScore([], makeMetrics(), 60);
    const expectedOverall = calculateOverallScore(
      result.security,
      result.quality,
      result.maintenance,
    );
    expect(result.overall).toBe(expectedOverall);
  });
});
