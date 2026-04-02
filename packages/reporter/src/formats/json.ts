/**
 * JSON report formatter.
 *
 * Outputs the full AuditReport as pretty-printed JSON, suitable for
 * piping into other tools or storing as an artifact.
 */

import type { AuditReport } from "@agent-audit/shared";

export const formatJson = (report: AuditReport): string => {
  return JSON.stringify(report, null, 2);
};
