import type { SkillAuditResult, SkillManifest } from "@agentsec/shared";

/**
 * Build a SkillAuditResult with sensible defaults. Pass partial overrides
 * for the fields you care about in each test.
 */
export function makeAuditResult(overrides: Partial<SkillAuditResult> = {}): SkillAuditResult {
  return {
    skill: {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      path: "/tmp/test-skill",
      platform: "openclaw",
      manifest: {
        name: "test-skill",
        version: "1.0.0",
        permissions: [],
        dependencies: {},
      },
      files: [],
    },
    score: {
      overall: 75,
      security: 80,
      quality: 70,
      maintenance: 65,
      grade: "B",
    },
    securityFindings: [],
    qualityMetrics: {
      codeComplexity: 5,
      testCoverage: 80,
      documentationScore: 60,
      maintenanceHealth: 70,
      dependencyCount: 3,
      outdatedDependencies: 0,
      hasReadme: true,
      hasLicense: true,
      hasTests: true,
      hasTypes: true,
      linesOfCode: 200,
    },
    policyViolations: [],
    recommendations: [],
    ...overrides,
  };
}

/**
 * Build an audit result whose skill manifest has the given overrides.
 * Avoids manually constructing the full skill object just to set
 * permissions or dependencies.
 */
export function makeAuditResultWithManifest(
  manifestOverrides: Partial<SkillManifest>,
  resultOverrides: Partial<SkillAuditResult> = {},
): SkillAuditResult {
  return makeAuditResult({
    ...resultOverrides,
    skill: {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      path: "/tmp/test-skill",
      platform: "openclaw",
      manifest: {
        name: "test-skill",
        version: "1.0.0",
        ...manifestOverrides,
      },
      files: [],
    },
  });
}
