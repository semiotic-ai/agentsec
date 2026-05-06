import type { PolicyConfig } from "@agentsec/shared";

/**
 * Strict preset:
 *  - Blocks any critical or high findings
 *  - Requires overall score >= 80
 */
export const strictPreset: PolicyConfig = {
  name: "strict",
  rules: [
    {
      id: "strict-critical-findings",
      description: "Block skills with critical security findings",
      severity: "critical",
      action: "block",
      condition: {
        type: "finding-exists",
        value: { severity: ["critical"] },
      },
    },
    {
      id: "strict-high-findings",
      description: "Block skills with high severity findings",
      severity: "high",
      action: "block",
      condition: {
        type: "finding-exists",
        value: { severity: ["high"] },
      },
    },
    {
      id: "strict-score-minimum",
      description: "Block skills with overall score below 80",
      severity: "high",
      action: "block",
      condition: {
        type: "score-below",
        value: { field: "overall", threshold: 80 },
      },
    },
    {
      id: "strict-medium-findings",
      description: "Warn on medium severity findings",
      severity: "medium",
      action: "warn",
      condition: {
        type: "finding-exists",
        value: { severity: ["medium"] },
      },
    },
  ],
};

/**
 * Standard preset:
 *  - Blocks critical findings
 *  - Warns on high findings
 *  - Requires overall score >= 60
 */
export const standardPreset: PolicyConfig = {
  name: "standard",
  rules: [
    {
      id: "standard-critical-findings",
      description: "Block skills with critical security findings",
      severity: "critical",
      action: "block",
      condition: {
        type: "finding-exists",
        value: { severity: ["critical"] },
      },
    },
    {
      id: "standard-high-findings",
      description: "Warn on high severity findings",
      severity: "high",
      action: "warn",
      condition: {
        type: "finding-exists",
        value: { severity: ["high"] },
      },
    },
    {
      id: "standard-score-minimum",
      description: "Block skills with overall score below 60",
      severity: "medium",
      action: "block",
      condition: {
        type: "score-below",
        value: { field: "overall", threshold: 60 },
      },
    },
    {
      id: "standard-medium-findings",
      description: "Informational notice on medium findings",
      severity: "medium",
      action: "info",
      condition: {
        type: "finding-exists",
        value: { severity: ["medium"] },
      },
    },
  ],
};

/**
 * Permissive preset:
 *  - Only blocks critical findings that have a CVE
 */
export const permissivePreset: PolicyConfig = {
  name: "permissive",
  rules: [
    {
      id: "permissive-critical-cve",
      description: "Block skills with critical findings that have a CVE",
      severity: "critical",
      action: "block",
      condition: {
        type: "finding-exists",
        value: { severity: ["critical"], withCve: true },
      },
    },
    {
      id: "permissive-critical-warn",
      description: "Warn on critical findings without CVE",
      severity: "critical",
      action: "warn",
      condition: {
        type: "finding-exists",
        value: { severity: ["critical"] },
      },
    },
  ],
};

/**
 * Enterprise preset:
 *  - Everything from strict
 *  - Requires license file
 *  - Requires TypeScript types
 *  - Requires tests
 */
export const enterprisePreset: PolicyConfig = {
  name: "enterprise",
  rules: [
    // Include all strict rules
    ...strictPreset.rules.map((rule) => ({
      ...rule,
      id: rule.id.replace("strict-", "enterprise-"),
    })),
    // Additional enterprise requirements
    {
      id: "enterprise-requires-license",
      description: "Block skills without a license",
      severity: "high",
      action: "block",
      condition: {
        type: "custom",
        value: {
          expression: "!result.qualityMetrics.hasLicense",
          label: "Skill must have a license",
        },
      },
    },
    {
      id: "enterprise-requires-types",
      description: "Block skills without TypeScript types",
      severity: "high",
      action: "block",
      condition: {
        type: "custom",
        value: {
          expression: "!result.qualityMetrics.hasTypes",
          label: "Skill must have TypeScript types",
        },
      },
    },
    {
      id: "enterprise-requires-tests",
      description: "Block skills without tests",
      severity: "high",
      action: "block",
      condition: {
        type: "custom",
        value: {
          expression: "!result.qualityMetrics.hasTests",
          label: "Skill must have tests",
        },
      },
    },
    {
      id: "enterprise-security-score",
      description: "Warn if security score is below 90",
      severity: "medium",
      action: "warn",
      condition: {
        type: "score-below",
        value: { field: "security", threshold: 90 },
      },
    },
  ],
};

/**
 * Map of preset name to preset config for easy lookup.
 */
export const presets: Record<string, PolicyConfig> = {
  strict: strictPreset,
  standard: standardPreset,
  permissive: permissivePreset,
  enterprise: enterprisePreset,
};

/**
 * Get a policy preset by name.
 * Returns undefined if the preset name is not recognized.
 */
export function getPreset(name: string): PolicyConfig | undefined {
  return presets[name];
}

/**
 * List all available preset names.
 */
export function listPresets(): string[] {
  return Object.keys(presets);
}
