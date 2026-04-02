export { MetricsAnalyzer } from "./analyzer";
export type { DetailedMetrics } from "./analyzer";

export { calculateComplexity, countTotalLinesOfCode } from "./complexity";
export type { ComplexityResult, FileComplexity } from "./complexity";

export { scoreDocumentation } from "./documentation";
export type { DocumentationResult } from "./documentation";

export { analyzeDependencies } from "./dependencies";
export type { DependencyResult } from "./dependencies";

export { scoreMaintenanceHealth } from "./maintenance";
export type { MaintenanceResult } from "./maintenance";
