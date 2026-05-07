import type { AgentSkill, SecurityFinding } from "@agentsec/shared";

/**
 * Rule: AST-04 (Web3 tightening) — Metadata Completeness
 *
 * Web3-specific tightening of AST04 (Insecure Metadata). Fires when a
 * web3-detected skill's manifest is missing fields that downstream
 * registries, runtimes, and other AST-W## rules need to function:
 *
 *   - `license`                          — provenance / trust
 *   - `permissions[]`                    — least-privilege enforcement
 *   - `metadata.openclaw`                — registry classification / routing
 *   - `web3.policy.allowedContracts`     — contract-target verification surface
 *
 * Each missing field produces an independent finding so reports surface
 * exactly which gaps exist. The base AST04 rule remains looser for
 * non-web3 skills; this rule only runs when the WEB3_RULES pack is
 * applied (i.e. when `detectWeb3` returned `isWeb3: true`).
 *
 * Findings reference the `web3-metadata-completeness` OWASP category
 * declared in `@agentsec/shared` and use stable IDs of the form
 * `W04M-XXX-N`, matching the sibling rule packs.
 */

const RULE_NAME = "web3-metadata-completeness";
const RULE_CATEGORY = "web3-metadata-completeness" as const;

const STUB_LICENSES = new Set(["", "UNKNOWN", "unknown", "TBD", "TODO", "NONE", "none"]);

/**
 * Returns true when the manifest carries a non-empty `metadata.openclaw`
 * block. The `metadata` field lives on the open-ended index signature of
 * `SkillManifest`, so we narrow it here rather than burdening the type.
 * An empty object counts as "present but unhelpful" — treat as missing.
 */
function hasOpenclawMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const openclaw = (metadata as Record<string, unknown>).openclaw;
  if (!openclaw || typeof openclaw !== "object") return false;
  return Object.keys(openclaw as Record<string, unknown>).length > 0;
}

export function checkMetadataCompleteness(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const m = skill.manifest;
  let counter = 0;

  if (!m.license || STUB_LICENSES.has(m.license)) {
    counter++;
    findings.push({
      id: `W04M-001-${counter}`,
      rule: RULE_NAME,
      severity: "medium",
      category: RULE_CATEGORY,
      title: "Web3 skill manifest is missing a license",
      description:
        "Web3 skills handle keys and value — provenance and license are critical for trust. Add an SPDX-style license identifier so downstream consumers can verify the skill's distribution terms.",
      file: "skill.json",
      evidence: `manifest.license = ${JSON.stringify(m.license)}`,
      remediation:
        'Add `"license": "MIT"` (or another SPDX identifier such as `Apache-2.0`) to skill.json and ship a matching LICENSE file.',
    });
  }

  if (!m.permissions || m.permissions.length === 0) {
    counter++;
    findings.push({
      id: `W04M-002-${counter}`,
      rule: RULE_NAME,
      severity: "medium",
      category: RULE_CATEGORY,
      title: "Web3 skill manifest declares no permissions",
      description:
        "A web3 skill that touches network and wallet must declare permissions explicitly so the runtime can enforce least-privilege. An empty or missing `permissions` array means the runtime has no allowlist to compare against.",
      file: "skill.json",
      evidence: "manifest.permissions is missing or empty",
      remediation:
        'Add a `"permissions"` array to skill.json (e.g. `["network:fetch", "wallet:sign-typed-data"]`) listing every capability the skill uses.',
    });
  }

  if (!hasOpenclawMetadata((m as Record<string, unknown>).metadata)) {
    counter++;
    findings.push({
      id: `W04M-003-${counter}`,
      rule: RULE_NAME,
      severity: "low",
      category: RULE_CATEGORY,
      title: "Web3 skill manifest has no `metadata.openclaw` block",
      description:
        "OpenClaw metadata enables registries to classify and route skills correctly. Without a `metadata.openclaw` block, the skill cannot advertise its tags, capabilities, or registry namespace to ClawHub / skills.sh consumers.",
      file: "skill.json",
      evidence: "manifest.metadata.openclaw is missing",
      remediation:
        'Add a `"metadata": { "openclaw": { "tags": [...], "namespace": "..." } }` block to skill.json.',
    });
  }

  const allowedContracts = m.web3?.policy?.allowedContracts;
  if (!allowedContracts || allowedContracts.length === 0) {
    counter++;
    findings.push({
      id: `W04M-004-${counter}`,
      rule: RULE_NAME,
      severity: "medium",
      category: RULE_CATEGORY,
      title: "Web3 skill manifest does not declare allowedContracts",
      description:
        "Without an explicit allowlist, no contract-target rule (AST-W06) can verify the skill is talking to the right router. Declared `allowedContracts` also feed the fee-skim detector (AST-W02 sub-rule) and the kill-switch / audit pipeline (AST-W12).",
      file: "skill.json",
      evidence: "manifest.web3.policy.allowedContracts is missing or empty",
      remediation:
        'Add `"web3": { "policy": { "allowedContracts": ["0x..."] } }` to skill.json, listing every router / settlement contract the skill is permitted to call.',
    });
  }

  return findings;
}
