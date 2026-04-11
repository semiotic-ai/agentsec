/**
 * SARIF 2.1.0 report formatter.
 *
 * Produces a Static Analysis Results Interchange Format (SARIF) document
 * that can be consumed by VS Code, GitHub Code Scanning, and other IDE
 * integrations.
 *
 * Spec: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */

import {
  AUDIT_VERSION,
  type AuditReport,
  type Severity,
  type SkillAuditResult,
} from "@agentsec/shared";

// ── SARIF type definitions (subset) ───────────────────────────────────── //

interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: SarifRun[];
}

interface SarifRun {
  tool: SarifTool;
  results: SarifResult[];
  invocations: SarifInvocation[];
  automationDetails: { id: string };
}

interface SarifTool {
  driver: SarifToolDriver;
}

interface SarifToolDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifRule[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  helpUri?: string;
  defaultConfiguration: {
    level: SarifLevel;
  };
  properties?: {
    tags?: string[];
    "security-severity"?: string;
  };
}

type SarifLevel = "error" | "warning" | "note" | "none";

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: SarifLevel;
  message: { text: string };
  locations?: SarifLocation[];
  fingerprints?: Record<string, string>;
  properties?: Record<string, unknown>;
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
      uriBaseId?: string;
    };
    region?: {
      startLine?: number;
      startColumn?: number;
    };
  };
  logicalLocations?: Array<{
    name: string;
    kind: string;
  }>;
}

interface SarifInvocation {
  executionSuccessful: boolean;
  startTimeUtc?: string;
  endTimeUtc?: string;
  properties?: Record<string, unknown>;
}

// ── Severity mapping ──────────────────────────────────────────────────── //

const toSarifLevel = (severity: Severity): SarifLevel => {
  switch (severity) {
    case "critical":
      return "error";
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "note";
    case "info":
      return "note";
  }
};

/**
 * Map severity to a CVSS-style numeric score for the
 * `security-severity` SARIF property (used by GitHub Code Scanning).
 */
const toSecuritySeverityScore = (severity: Severity): string => {
  switch (severity) {
    case "critical":
      return "9.5";
    case "high":
      return "7.5";
    case "medium":
      return "5.0";
    case "low":
      return "2.5";
    case "info":
      return "0.0";
  }
};

// ── Builder ─────────────────────────────────────────────────────────────── //

const collectUniqueRules = (
  results: SkillAuditResult[],
): { rules: SarifRule[]; ruleIndexMap: Map<string, number> } => {
  const ruleIndexMap = new Map<string, number>();
  const rules: SarifRule[] = [];

  for (const r of results) {
    for (const f of r.securityFindings) {
      if (!ruleIndexMap.has(f.rule)) {
        ruleIndexMap.set(f.rule, rules.length);
        rules.push({
          id: f.rule,
          name: f.rule
            .split(/[-_]/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(""),
          shortDescription: { text: f.title },
          fullDescription: f.description ? { text: f.description } : undefined,
          defaultConfiguration: {
            level: toSarifLevel(f.severity),
          },
          properties: {
            tags: [f.category, "security"],
            "security-severity": toSecuritySeverityScore(f.severity),
          },
        });
      }
    }
  }

  return { rules, ruleIndexMap };
};

const buildResults = (
  results: SkillAuditResult[],
  ruleIndexMap: Map<string, number>,
): SarifResult[] => {
  const sarifResults: SarifResult[] = [];

  for (const r of results) {
    for (const f of r.securityFindings) {
      const ruleIndex = ruleIndexMap.get(f.rule) ?? 0;

      const result: SarifResult = {
        ruleId: f.rule,
        ruleIndex,
        level: toSarifLevel(f.severity),
        message: {
          text: f.description ? `${f.title}: ${f.description}` : f.title,
        },
        fingerprints: {
          "agentsec/finding-id": f.id,
        },
        properties: {
          severity: f.severity,
          category: f.category,
          skillName: r.skill.name,
          skillPath: r.skill.path,
          ...(f.evidence ? { evidence: f.evidence } : {}),
          ...(f.remediation ? { remediation: f.remediation } : {}),
          ...(f.cve ? { cve: f.cve } : {}),
        },
      };

      if (f.file) {
        const location: SarifLocation = {
          physicalLocation: {
            artifactLocation: {
              uri: f.file,
              uriBaseId: "%SRCROOT%",
            },
          },
          logicalLocations: [
            {
              name: r.skill.name,
              kind: "module",
            },
          ],
        };

        if (f.line !== undefined) {
          location.physicalLocation.region = {
            startLine: f.line,
            ...(f.column !== undefined ? { startColumn: f.column } : {}),
          };
        }

        result.locations = [location];
      }

      sarifResults.push(result);
    }
  }

  return sarifResults;
};

// ── Public API ──────────────────────────────────────────────────────────── //

export const formatSarif = (report: AuditReport): string => {
  const { rules, ruleIndexMap } = collectUniqueRules(report.skills);
  const results = buildResults(report.skills, ruleIndexMap);

  const sarifLog: SarifLog = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "AgentSec",
            version: AUDIT_VERSION,
            informationUri: "https://agentsec.sh",
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: report.timestamp,
            properties: {
              reportId: report.id,
              platform: report.platform,
              totalSkills: report.summary.totalSkills,
              averageScore: report.summary.averageScore,
            },
          },
        ],
        automationDetails: {
          id: `agentsec/${report.id}`,
        },
      },
    ],
  };

  return JSON.stringify(sarifLog, null, 2);
};
