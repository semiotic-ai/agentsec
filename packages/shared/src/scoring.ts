import type { AuditGrade, AuditScore, SecurityFinding, QualityMetrics } from "./types";
import { severityWeight } from "./severity";

export function calculateSecurityScore(findings: SecurityFinding[]): number {
  if (findings.length === 0) return 100;
  const totalPenalty = findings.reduce(
    (sum, f) => sum + severityWeight(f.severity) * 3,
    0
  );
  return Math.max(0, Math.min(100, 100 - totalPenalty));
}

export function calculateQualityScore(metrics: QualityMetrics): number {
  let score = 50; // base

  // Code complexity (lower is better, cap at 20)
  score += Math.max(0, 15 - metrics.codeComplexity);

  // Documentation
  score += metrics.documentationScore * 10;

  // Has tests
  if (metrics.hasTests) score += 5;
  if (metrics.testCoverage !== null) {
    score += (metrics.testCoverage / 100) * 10;
  }

  // Has types
  if (metrics.hasTypes) score += 5;

  // Has readme/license
  if (metrics.hasReadme) score += 3;
  if (metrics.hasLicense) score += 2;

  // Dependency health
  if (metrics.outdatedDependencies > 0) {
    score -= Math.min(10, metrics.outdatedDependencies * 2);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateOverallScore(security: number, quality: number, maintenance: number): number {
  // Security is weighted most heavily
  return Math.round(security * 0.5 + quality * 0.3 + maintenance * 0.2);
}

export function scoreToGrade(score: number): AuditGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function buildAuditScore(
  securityFindings: SecurityFinding[],
  qualityMetrics: QualityMetrics,
  maintenanceScore: number
): AuditScore {
  const security = calculateSecurityScore(securityFindings);
  const quality = calculateQualityScore(qualityMetrics);
  const overall = calculateOverallScore(security, quality, maintenanceScore);
  return {
    overall,
    security,
    quality,
    maintenance: maintenanceScore,
    grade: scoreToGrade(overall),
  };
}
