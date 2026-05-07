/**
 * @agentsec/reporter
 *
 * Generates audit reports in multiple output formats:
 * - text:  ANSI-colored terminal output
 * - json:  Pretty-printed JSON
 * - sarif: SARIF 2.1.0 for IDE / CI integration
 * - html:  Self-contained HTML with dark-themed dashboard
 * - md:    GitHub-flavored Markdown (per-skill or comparison matrix)
 */

// Color utilities
export {
  blue,
  bold,
  box,
  brightBlue,
  brightCyan,
  brightGreen,
  brightRed,
  brightWhite,
  brightYellow,
  cyan,
  dim,
  gradeColor,
  gray,
  green,
  italic,
  magenta,
  progressBar,
  red,
  scoreGauge,
  severityColor,
  stripAnsi,
  symbols,
  teal,
  underline,
  visibleLength,
  white,
  yellow,
} from "./colors.js";
export { formatComparisonHtml } from "./formats/comparison-html.js";
export {
  buildComparison,
  type CellSeverity,
  type ComparisonCell,
  type ComparisonRule,
  type ComparisonRuleGroup,
  type ComparisonSkill,
  type ComparisonSummary,
  type ComparisonView,
  formatComparisonJson,
} from "./formats/comparison-json.js";
export { formatComparisonMd } from "./formats/comparison-md.js";
export { formatHtml } from "./formats/html.js";
export { formatJson } from "./formats/json.js";
export { formatMd } from "./formats/md.js";
export { formatSarif } from "./formats/sarif.js";
// Individual formatters for direct use
export { formatText } from "./formats/text.js";
export { ReportGenerator } from "./reporter.js";
