/**
 * @agent-audit/reporter
 *
 * Generates audit reports in multiple output formats:
 * - text:  ANSI-colored terminal output
 * - json:  Pretty-printed JSON
 * - sarif: SARIF 2.1.0 for IDE / CI integration
 * - html:  Self-contained HTML with dark-themed dashboard
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
export { formatHtml } from "./formats/html.js";
export { formatJson } from "./formats/json.js";
export { formatSarif } from "./formats/sarif.js";
// Individual formatters for direct use
export { formatText } from "./formats/text.js";
export { ReportGenerator } from "./reporter.js";
