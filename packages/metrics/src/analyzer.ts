import type { AgentSkill, QualityMetrics } from "@agentsec/shared";
import type { ComplexityResult } from "./complexity";
import { calculateComplexity, countTotalLinesOfCode } from "./complexity";
import type { DependencyResult } from "./dependencies";
import { analyzeDependencies } from "./dependencies";
import type { DocumentationResult } from "./documentation";
import { scoreDocumentation } from "./documentation";
import type { MaintenanceResult } from "./maintenance";
import { scoreMaintenanceHealth } from "./maintenance";

/**
 * Extended metrics result including detailed breakdowns from each analyzer.
 */
export interface DetailedMetrics extends QualityMetrics {
  /** Detailed complexity breakdown */
  complexityDetails: ComplexityResult;
  /** Detailed documentation breakdown */
  documentationDetails: DocumentationResult;
  /** Detailed dependency breakdown */
  dependencyDetails: DependencyResult;
  /** Detailed maintenance breakdown */
  maintenanceDetails: MaintenanceResult;
}

/**
 * MetricsAnalyzer computes quality metrics for an AgentSkill.
 *
 * It orchestrates the individual analyzers (complexity, documentation,
 * dependencies, maintenance) and produces a unified QualityMetrics result
 * compatible with the shared types.
 */
export class MetricsAnalyzer {
  private skill: AgentSkill;

  constructor(skill: AgentSkill) {
    this.skill = skill;
  }

  /**
   * Run all analyzers and return the standard QualityMetrics.
   */
  analyze(): QualityMetrics {
    const detailed = this.analyzeDetailed();
    return {
      codeComplexity: detailed.codeComplexity,
      testCoverage: detailed.testCoverage,
      documentationScore: detailed.documentationScore,
      maintenanceHealth: detailed.maintenanceHealth,
      dependencyCount: detailed.dependencyCount,
      outdatedDependencies: detailed.outdatedDependencies,
      hasReadme: detailed.hasReadme,
      hasLicense: detailed.hasLicense,
      hasTests: detailed.hasTests,
      hasTypes: detailed.hasTypes,
      linesOfCode: detailed.linesOfCode,
    };
  }

  /**
   * Run all analyzers and return detailed metrics with full breakdowns.
   */
  analyzeDetailed(): DetailedMetrics {
    const complexityResult = this.analyzeComplexity();
    const documentationResult = this.analyzeDocumentation();
    const dependencyResult = this.analyzeDependencies();
    const maintenanceResult = this.analyzeMaintenance();
    const linesOfCode = this.countLines();

    return {
      codeComplexity: complexityResult.score,
      testCoverage: null, // Requires runtime analysis; cannot be statically determined
      documentationScore: documentationResult.score,
      maintenanceHealth: maintenanceResult.score,
      dependencyCount: dependencyResult.totalDependencies,
      outdatedDependencies: dependencyResult.outdatedDependencies,
      hasReadme: documentationResult.hasReadme,
      hasLicense: maintenanceResult.hasLicense,
      hasTests: maintenanceResult.hasTests,
      hasTypes: maintenanceResult.hasTypes,
      linesOfCode,
      complexityDetails: complexityResult,
      documentationDetails: documentationResult,
      dependencyDetails: dependencyResult,
      maintenanceDetails: maintenanceResult,
    };
  }

  /**
   * Calculate cyclomatic complexity across all source files.
   */
  analyzeComplexity(): ComplexityResult {
    return calculateComplexity(this.skill.files);
  }

  /**
   * Score documentation quality.
   */
  analyzeDocumentation(): DocumentationResult {
    return scoreDocumentation(this.skill.files);
  }

  /**
   * Analyze dependencies.
   */
  analyzeDependencies(): DependencyResult {
    return analyzeDependencies(this.skill);
  }

  /**
   * Score maintenance health.
   */
  analyzeMaintenance(): MaintenanceResult {
    return scoreMaintenanceHealth(this.skill);
  }

  /**
   * Count total lines of code across source files.
   */
  countLines(): number {
    return countTotalLinesOfCode(this.skill.files);
  }
}
