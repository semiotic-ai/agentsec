/**
 * ReportGenerator - main entry point for formatting audit reports.
 *
 * Accepts an AuditReport and an OutputFormat and dispatches to the
 * appropriate formatter.
 */

import type { AuditReport, OutputFormat } from "@agent-audit/shared";
import { formatHtml } from "./formats/html.js";
import { formatJson } from "./formats/json.js";
import { formatSarif } from "./formats/sarif.js";
import { formatText } from "./formats/text.js";

export class ReportGenerator {
  /**
   * Generate a formatted report string.
   *
   * @param report  - The complete audit report data.
   * @param format  - Desired output format.
   * @returns         The formatted report as a string.
   */
  generate(report: AuditReport, format: OutputFormat): string {
    switch (format) {
      case "text":
        return formatText(report);
      case "json":
        return formatJson(report);
      case "sarif":
        return formatSarif(report);
      case "html":
        return formatHtml(report);
      default: {
        const _exhaustive: never = format;
        throw new Error(`Unsupported output format: ${String(_exhaustive)}`);
      }
    }
  }
}
