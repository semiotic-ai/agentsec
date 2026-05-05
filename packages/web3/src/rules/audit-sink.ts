import type { AgentSkill, SecurityFinding, SkillFile, Web3ManifestBlock } from "@agentsec/shared";
import {
  getEvidenceLine,
  getLineNumber,
  isInComment,
  SEND_TX_RE,
  SIGN_TX_RE,
  shouldScanFile,
} from "../primitives/eth";

/**
 * Rule: AST-W12 — No On-Chain Action Audit / Kill-Switch
 *
 * Detects skills that lack a tamper-evident audit trail of on-chain
 * actions (sink, kill-switch, runbook, policy versioning, stable
 * version field). Most signals are manifest-centric; the code-level
 * checks look for signing call sites that emit no audit token.
 *
 * Findings reference the `web3-no-audit-killswitch` OWASP category
 * declared in `@agentsec/shared` and use stable IDs of the form
 * `W12-XXX-N`, matching the sibling rule packs.
 */

const RULE_NAME = "web3-no-audit-killswitch";
const RULE_CATEGORY = "web3-no-audit-killswitch" as const;

/**
 * Tokens that count as an audit/journal sink. Bare verbs like `log` and
 * `record` matched any `console.log` line and produced ~100% false-negative
 * coverage (the rule passed for every skill that wrote any debug log).
 *
 * The new shape requires sink-shaped phrasing: a method-style call (`audit.X(`,
 * `journal.X(`, `auditTrail(`), an explicit Solidity event emit, or a named
 * audit construct (`AuditSink`, `AuditTrail`, `audit.sink(`, `audit.record(`).
 * Plain `console.log` no longer counts.
 */
const AUDIT_TOKEN_RE =
  /\b(?:audit|journal|auditTrail)\s*\.\s*[a-zA-Z]\w*\s*\(|\bemit\s+\w+\s*\(|\b(?:AuditSink|AuditTrail|attest|attestation)\b|\bjournal\s*\.\s*record\s*\(/i;

/** Tokens that count as a policy-version / correlation marker in the same file. */
const POLICY_VERSION_TOKEN_RE =
  /\b(?:policyVersion|policy_version|auditId|requestId|correlationId)\b/;

/** Indicates the skill describes itself as autonomous/automated. */
const AUTONOMY_TOKEN_RE = /\b(?:autonomous|automated|agent\s+will)\b/i;

/** Function definition introducing a likely transaction-signing call site. */
const SIGNING_FN_RE =
  /\b(?:function|const|let|var|async\s+function)\s+(?:sign(?:Tx|Transaction|Message)?|sendTx|signAndSend)\b|\b(?:async\s+)?(?:sign(?:Tx|Transaction|Message)?|sendTx|signAndSend)\s*[:=]\s*(?:async\s*)?(?:\(|function)/;

/** Stub version values that defeat forensic version tracking. */
const STUB_VERSIONS = new Set(["0.0.0", "0.1.0"]);

/** Whether any field of a `web3` block is explicitly populated. */
function isWeb3BlockPresent(web3: Web3ManifestBlock | undefined): web3 is Web3ManifestBlock {
  if (!web3) return false;
  return (
    web3.chains !== undefined ||
    web3.signers !== undefined ||
    web3.policy !== undefined ||
    web3.mcpServers !== undefined ||
    web3.audit !== undefined ||
    web3.killSwitch !== undefined ||
    web3.oracle !== undefined ||
    web3.bridgeProvider !== undefined ||
    web3.sessionKey !== undefined ||
    web3.incident !== undefined ||
    web3.signs7702 !== undefined ||
    web3.rpcRegistry !== undefined
  );
}

/** Find the first regex match outside of comments. */
function findCodeMatch(file: SkillFile, pattern: RegExp): RegExpExecArray | null {
  const re = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = re.exec(file.content)) !== null) {
    if (!isInComment(file.content, match.index)) return match;
  }
  return null;
}

/** Walk SKILL.md / README content looking for an autonomy claim. */
function bodyClaimsAutonomy(skill: AgentSkill): { file: SkillFile; index: number } | null {
  for (const file of skill.files) {
    const lower = file.relativePath.toLowerCase();
    if (!(lower.endsWith("skill.md") || lower.endsWith("readme.md") || lower.endsWith("readme"))) {
      continue;
    }
    const match = findCodeMatch(file, AUTONOMY_TOKEN_RE);
    if (match) return { file, index: match.index };
  }
  return null;
}

export function checkAuditSink(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;
  const web3 = skill.manifest.web3;
  const web3Present = isWeb3BlockPresent(web3);

  if (web3Present) {
    if (!web3.audit || !web3.audit.sink) {
      counter++;
      findings.push({
        id: `W12-001-${counter}`,
        rule: RULE_NAME,
        severity: "high",
        category: RULE_CATEGORY,
        title: "Manifest declares web3 capabilities without an audit sink",
        description:
          "The skill's manifest exposes a `web3` block but does not declare `web3.audit.sink`. Without a tamper-evident audit trail recording which key signed which transaction under which policy on whose behalf, on-chain actions cannot be reconstructed during incident response.",
        evidence: "manifest.web3.audit.sink is missing",
        remediation:
          "Declare `web3.audit.sink` in the manifest, pointing at an append-only log (e.g. an on-chain event emitter, a signed off-chain journal, or a SIEM endpoint). Each signed action should record the signer key id, transaction hash, authorization id, principal, and policy version.",
      });
    }

    if (!web3.killSwitch || !web3.killSwitch.contract) {
      counter++;
      findings.push({
        id: `W12-002-${counter}`,
        rule: RULE_NAME,
        severity: "high",
        category: RULE_CATEGORY,
        title: "Manifest declares web3 capabilities without a kill-switch contract",
        description:
          "The `web3` block does not declare an out-of-band kill switch (`web3.killSwitch.contract`). Operators have no documented way to revoke the skill's signing authority when an incident is detected.",
        evidence: "manifest.web3.killSwitch.contract is missing",
        remediation:
          "Declare `web3.killSwitch.contract` (and `chainId`) in the manifest. The kill-switch should be reachable without the skill's cooperation — for example, a multisig-controlled pause contract or an EIP-7715 permission registry that can revoke session keys instantly.",
      });
    }

    if (!web3.incident || !web3.incident.runbook) {
      counter++;
      findings.push({
        id: `W12-003-${counter}`,
        rule: RULE_NAME,
        severity: "medium",
        category: RULE_CATEGORY,
        title: "Manifest declares web3 capabilities without an incident runbook",
        description:
          "The `web3` block does not declare `web3.incident.runbook`. Without a documented response plan, operators must improvise during a live compromise — slowing kill-switch activation and audit collection.",
        evidence: "manifest.web3.incident.runbook is missing",
        remediation:
          "Declare `web3.incident.runbook` with a URL to a runbook covering kill-switch activation, audit-sink retrieval, key rotation, and stakeholder communication.",
      });
    }

    if (skill.manifest.version === undefined || STUB_VERSIONS.has(skill.manifest.version)) {
      counter++;
      findings.push({
        id: `W12-030-${counter}`,
        rule: RULE_NAME,
        severity: "low",
        category: RULE_CATEGORY,
        title: "Web3-capable skill is pinned to a stub version",
        description: `The skill declares Web3 capabilities but its manifest version is "${skill.manifest.version ?? "<unset>"}", which is a stub value. Audit records and kill-switch decisions need a stable, monotonically-increasing version field so forensics can correlate a signed action with the exact skill build that produced it.`,
        evidence: `manifest.version = ${JSON.stringify(skill.manifest.version)}`,
        remediation:
          "Set `version` in the manifest to a real semver release (e.g. `1.0.0`) before deploying any signing capability. Bump on every code change so audit logs can pin actions to a specific build.",
      });
    }

    const autonomy = bodyClaimsAutonomy(skill);
    if (autonomy && (!web3.killSwitch || !web3.killSwitch.contract)) {
      counter++;
      findings.push({
        id: `W12-020-${counter}`,
        rule: RULE_NAME,
        severity: "medium",
        category: RULE_CATEGORY,
        title: "Skill describes itself as autonomous but has no kill switch",
        description:
          "The skill body advertises autonomous or automated behavior, yet the manifest does not declare a `web3.killSwitch.contract`. Autonomous signing with no out-of-band stop button is a textbook AST-W12 pattern.",
        file: autonomy.file.relativePath,
        line: getLineNumber(autonomy.file.content, autonomy.index),
        evidence: getEvidenceLine(autonomy.file.content, autonomy.index),
        remediation:
          "Either remove the autonomy claim from the skill description or wire up a real kill switch and reference it via `web3.killSwitch.contract`.",
      });
    }
  }

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;

    const sendMatch = findCodeMatch(file, SEND_TX_RE);
    const signMatch = findCodeMatch(file, SIGN_TX_RE);
    const txMatch = sendMatch ?? signMatch;
    if (txMatch && !AUDIT_TOKEN_RE.test(file.content)) {
      counter++;
      findings.push({
        id: `W12-010-${counter}`,
        rule: RULE_NAME,
        severity: "medium",
        category: RULE_CATEGORY,
        title: "Transaction signing without an audit record",
        description:
          "This file calls a transaction-signing or send primitive but contains no audit/journal/emit/log/record/trail token. Signed actions appear to leave no local trace, which makes after-the-fact reconstruction impossible.",
        file: file.relativePath,
        line: getLineNumber(file.content, txMatch.index),
        evidence: getEvidenceLine(file.content, txMatch.index),
        remediation:
          "Before each signed call, append a structured record (signer id, target contract, selector, value, tx hash, authorization id, policy version) to the audit sink declared in `web3.audit.sink`.",
      });
    }

    const signingFnMatch = findCodeMatch(file, SIGNING_FN_RE);
    if (signingFnMatch && !POLICY_VERSION_TOKEN_RE.test(file.content)) {
      counter++;
      findings.push({
        id: `W12-011-${counter}`,
        rule: RULE_NAME,
        severity: "low",
        category: RULE_CATEGORY,
        title: "Signing function lacks policy versioning",
        description:
          "This file defines a signing function but contains no `policyVersion` / `policy_version` / `auditId` / `requestId` / `correlationId` token. Audit entries cannot be tied back to the specific policy decision or upstream request that authorized the signature.",
        file: file.relativePath,
        line: getLineNumber(file.content, signingFnMatch.index),
        evidence: getEvidenceLine(file.content, signingFnMatch.index),
        remediation:
          "Thread a policyVersion (and a per-request correlationId) through every signing call, and persist them alongside the signed payload in the audit sink.",
      });
    }
  }

  return findings;
}
