/**
 * Shared mock data factories for reporter tests.
 */

import type {
  AgentSkill,
  AuditReport,
  AuditScore,
  AuditSummary,
  QualityMetrics,
  SecurityFinding,
  SkillAuditResult,
} from "@agentsec/shared";

export const makeSkill = (overrides: Partial<AgentSkill> = {}): AgentSkill => ({
  id: "skill-test-1",
  name: "test-skill",
  version: "1.0.0",
  path: "/skills/test-skill",
  platform: "openclaw",
  manifest: {
    name: "test-skill",
    version: "1.0.0",
    description: "A test skill",
    permissions: ["network"],
  },
  files: [],
  ...overrides,
});

export const makeFinding = (overrides: Partial<SecurityFinding> = {}): SecurityFinding => ({
  id: "finding-1",
  rule: "no-eval",
  severity: "high",
  category: "skill-injection",
  title: "Eval usage detected",
  description: "Using eval() allows arbitrary code execution",
  file: "index.ts",
  line: 42,
  column: 5,
  evidence: "eval(userInput)",
  remediation: "Use a safe parser instead of eval()",
  ...overrides,
});

export const makeQualityMetrics = (overrides: Partial<QualityMetrics> = {}): QualityMetrics => ({
  codeComplexity: 8,
  testCoverage: 75,
  documentationScore: 60,
  maintenanceHealth: 70,
  dependencyCount: 5,
  outdatedDependencies: 1,
  hasReadme: true,
  hasLicense: true,
  hasTests: true,
  hasTypes: true,
  linesOfCode: 500,
  ...overrides,
});

export const makeScore = (overrides: Partial<AuditScore> = {}): AuditScore => ({
  overall: 72,
  security: 65,
  quality: 78,
  maintenance: 70,
  grade: "C",
  ...overrides,
});

export const makeSkillResult = (overrides: Partial<SkillAuditResult> = {}): SkillAuditResult => ({
  skill: makeSkill(),
  score: makeScore(),
  securityFindings: [makeFinding()],
  qualityMetrics: makeQualityMetrics(),
  policyViolations: [],
  recommendations: [],
  ...overrides,
});

export const makeSummary = (overrides: Partial<AuditSummary> = {}): AuditSummary => ({
  totalSkills: 1,
  averageScore: 72,
  criticalFindings: 0,
  highFindings: 1,
  mediumFindings: 0,
  lowFindings: 0,
  blockedSkills: 0,
  certifiedSkills: 1,
  ...overrides,
});

export const makeReport = (overrides: Partial<AuditReport> = {}): AuditReport => ({
  id: "report-123",
  timestamp: "2025-01-15T10:30:00Z",
  platform: "openclaw",
  skills: [makeSkillResult()],
  summary: makeSummary(),
  ...overrides,
});

export const makeEmptyReport = (): AuditReport =>
  makeReport({
    skills: [
      makeSkillResult({
        securityFindings: [],
        policyViolations: [],
        recommendations: [],
      }),
    ],
    summary: makeSummary({
      highFindings: 0,
    }),
  });

export const makeReportWithManyFindings = (): AuditReport => {
  const findings: SecurityFinding[] = [
    makeFinding({ id: "f-1", severity: "critical", title: "Critical vuln", rule: "no-secrets" }),
    makeFinding({ id: "f-2", severity: "high", title: "High vuln", rule: "no-eval" }),
    makeFinding({ id: "f-3", severity: "medium", title: "Medium vuln", rule: "safe-regex" }),
    makeFinding({ id: "f-4", severity: "low", title: "Low vuln", rule: "prefer-const" }),
    makeFinding({ id: "f-5", severity: "info", title: "Info note", rule: "style-check" }),
  ];

  return makeReport({
    skills: [
      makeSkillResult({
        securityFindings: findings,
        policyViolations: [
          {
            policy: "no-critical-vulns",
            severity: "critical",
            message: "Critical vulnerability found",
            action: "block",
          },
          {
            policy: "require-tests",
            severity: "medium",
            message: "Tests required",
            action: "warn",
          },
        ],
        recommendations: [
          {
            category: "security",
            priority: "critical",
            title: "Fix eval",
            description: "Remove eval calls",
            effort: "low",
          },
          {
            category: "quality",
            priority: "medium",
            title: "Add tests",
            description: "Write unit tests",
            effort: "medium",
          },
        ],
      }),
    ],
    summary: makeSummary({
      criticalFindings: 1,
      highFindings: 1,
      mediumFindings: 1,
      lowFindings: 1,
      blockedSkills: 1,
      certifiedSkills: 0,
    }),
  });
};
