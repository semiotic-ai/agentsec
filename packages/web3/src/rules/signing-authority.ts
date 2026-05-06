import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import {
  getEvidenceLine,
  getLineNumber,
  isInComment,
  PERSONAL_SIGN_RE,
  SEND_TX_RE,
  SIGN_TX_RE,
  shouldScanFile,
} from "../primitives/eth";

const RULE = "web3-signing-authority";
const CATEGORY = "web3-signing-authority" as const;

const AUTONOMY_VERBS = ["trade", "swap", "buy", "sell", "rebalance", "execute"];
const AUTONOMY_QUALIFIERS = ["for you", "automatically", "autonomous"];

interface SigningPrimitive {
  pattern: RegExp;
  primitive: string;
}

const SIGNING_PRIMITIVES: SigningPrimitive[] = [
  { pattern: SEND_TX_RE, primitive: "eth_sendTransaction" },
  { pattern: SIGN_TX_RE, primitive: "signTransaction" },
  { pattern: PERSONAL_SIGN_RE, primitive: "personal_sign" },
];

function hasHotSigner(signers: readonly string[] | undefined): boolean {
  if (!signers) return false;
  return signers.includes("hot");
}

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function findAutonomyHints(file: SkillFile): { line: number; evidence: string } | null {
  const lower = file.content.toLowerCase();
  for (const verb of AUTONOMY_VERBS) {
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(verb, from);
      if (idx === -1) break;
      // Look for a qualifier within ~80 chars on either side to keep the
      // signal local to a single sentence rather than a whole document.
      const windowStart = Math.max(0, idx - 80);
      const windowEnd = Math.min(lower.length, idx + verb.length + 80);
      const window = lower.slice(windowStart, windowEnd);
      for (const qualifier of AUTONOMY_QUALIFIERS) {
        if (window.includes(qualifier)) {
          return {
            line: getLineNumber(file.content, idx),
            evidence: getEvidenceLine(file.content, idx),
          };
        }
      }
      from = idx + verb.length;
    }
  }
  return null;
}

export function checkSigningAuthority(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  const web3 = skill.manifest.web3;
  const signers = web3?.signers;
  const policy = web3?.policy;
  const hot = hasHotSigner(signers);

  if (hot && (!policy || policy.maxValuePerTx === undefined)) {
    counter++;
    findings.push({
      id: `W01-001-${counter}`,
      rule: RULE,
      severity: "critical",
      category: CATEGORY,
      title: "Hot signer has no per-call value cap",
      description:
        "The skill declares a hot signing key but does not set web3.policy.maxValuePerTx. A prompt-injected or hallucinated transaction can spend the full balance of the signer in a single call.",
      remediation:
        "Add web3.policy.maxValuePerTx to the manifest and enforce it at sign time. Pick a cap derived from the smallest legitimate transaction the skill needs to send.",
    });
  }

  if (hot && !isNonEmptyArray(policy?.allowedContracts)) {
    counter++;
    findings.push({
      id: `W01-002-${counter}`,
      rule: RULE,
      severity: "high",
      category: CATEGORY,
      title: "Hot signer has no contract allowlist",
      description:
        "The skill declares a hot signing key but does not enumerate web3.policy.allowedContracts. Any contract address the model produces becomes a valid signing target, including approval traps and drainer contracts.",
      remediation:
        "Populate web3.policy.allowedContracts with the explicit set of addresses the skill is intended to call, and reject any signing request whose `to` field is not in that set.",
    });
  }

  const hasAllowedChains = isNonEmptyArray(policy?.allowedChains) || isNonEmptyArray(web3?.chains);
  if (hot && !hasAllowedChains) {
    counter++;
    findings.push({
      id: `W01-003-${counter}`,
      rule: RULE,
      severity: "high",
      category: CATEGORY,
      title: "Hot signer has no chain restriction",
      description:
        "The skill declares a hot signing key but does not list web3.policy.allowedChains (or web3.chains). The same key can be used to sign transactions on any chain the RPC happens to expose, including chains where balances or allowances are not visible to the operator.",
      remediation:
        "Declare the exact chain IDs the skill is allowed to sign for in web3.policy.allowedChains and reject any payload whose chainId is not in that set.",
    });
  }

  if (hot && policy?.dailyCap === undefined) {
    counter++;
    findings.push({
      id: `W01-004-${counter}`,
      rule: RULE,
      severity: "medium",
      category: CATEGORY,
      title: "Hot signer has no aggregate daily cap",
      description:
        "The skill declares a hot signing key but does not set web3.policy.dailyCap. Even with a per-call cap, an attacker can drain the signer through repeated small calls within a short window.",
      remediation:
        "Add web3.policy.dailyCap as a rolling 24h aggregate limit and tear down the signing session when the cap is reached.",
    });
  }

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;

    if (web3 === undefined) {
      const matched = new Set<string>();
      for (const { pattern, primitive } of SIGNING_PRIMITIVES) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
        while ((match = pattern.exec(file.content)) !== null) {
          if (isInComment(file.content, match.index)) continue;
          if (matched.has(`${file.relativePath}:${primitive}`)) continue;
          matched.add(`${file.relativePath}:${primitive}`);
          counter++;
          findings.push({
            id: `W01-010-${counter}`,
            rule: RULE,
            severity: "high",
            category: CATEGORY,
            title: "Signing primitive used without web3 manifest block",
            description: `The skill calls ${primitive} but does not declare a web3 capability block. Without a declared signer type, value cap, or contract allowlist the skill silently inherits whatever signing authority the host wallet is willing to grant.`,
            file: file.relativePath,
            line: getLineNumber(file.content, match.index),
            evidence: getEvidenceLine(file.content, match.index),
            remediation:
              "Add a `web3` block to the manifest declaring the signer type, allowed chains, allowed contracts, per-call value cap, and daily cap. The block also tells operators what authority the skill needs, which makes review possible.",
          });
        }
      }
    }

    if (web3?.sessionKey?.expiry === undefined) {
      const hint = findAutonomyHints(file);
      if (hint) {
        counter++;
        findings.push({
          id: `W01-020-${counter}`,
          rule: RULE,
          severity: "medium",
          category: CATEGORY,
          title: "Autonomous-trader prose without scoped session key",
          description:
            "The skill describes itself as taking autonomous trading or execution actions on the user's behalf but does not declare a session key with an expiry. Long-lived signing authority for an autonomous agent compounds the blast radius of any single compromise.",
          file: file.relativePath,
          line: hint.line,
          evidence: hint.evidence,
          remediation:
            "Declare web3.sessionKey with an explicit expiry, value limit, and target/selector list (ERC-7715 style) so the agent's authority is short-lived and narrowly scoped.",
        });
        // Only one autonomy finding per file — the prose is the same signal
        // even when the verb appears multiple times.
      }
    }
  }

  return findings;
}
