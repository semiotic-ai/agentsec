import type { Severity } from "./types";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2,
  info: 0,
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export function severityWeight(severity: Severity): number {
  return SEVERITY_WEIGHT[severity];
}

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}

export function isBlockingSeverity(severity: Severity): boolean {
  return severity === "critical" || severity === "high";
}
