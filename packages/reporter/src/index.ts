/**
 * @agent-audit/reporter
 *
 * Generates audit reports in multiple output formats:
 * - text:  ANSI-colored terminal output
 * - json:  Pretty-printed JSON
 * - sarif: SARIF 2.1.0 for IDE / CI integration
 * - html:  Self-contained HTML with dark-themed dashboard
 */

export { ReportGenerator } from "./reporter.js";

// Individual formatters for direct use
export { formatText } from "./formats/text.js";
export { formatJson } from "./formats/json.js";
export { formatSarif } from "./formats/sarif.js";
export { formatHtml } from "./formats/html.js";

// Color utilities
export {
  bold,
  dim,
  italic,
  underline,
  red,
  green,
  yellow,
  blue,
  cyan,
  magenta,
  gray,
  white,
  brightRed,
  brightGreen,
  brightYellow,
  brightBlue,
  brightCyan,
  brightWhite,
  teal,
  severityColor,
  gradeColor,
  stripAnsi,
  visibleLength,
  progressBar,
  scoreGauge,
  symbols,
  box,
} from "./colors.js";
