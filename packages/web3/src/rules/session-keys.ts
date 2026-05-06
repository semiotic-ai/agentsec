import type { AgentSkill, SecurityFinding, SkillFile, Web3ManifestBlock } from "@agentsec/shared";
import delegateTargets from "../data/delegate-targets.json" with { type: "json" };
import {
  getEvidenceLine,
  getLineNumber,
  isInComment,
  REQUEST_PERMISSIONS_RE,
  shouldScanFile,
} from "../primitives/eth";

/**
 * Rule: AST-W09 — Session-Key / Permission-Caveat Erosion
 *
 * Detects skills using ERC-7715/7710 (or vendor session-key systems like
 * Privy, Biconomy, ZeroDev) that request session permissions which are
 * too broad, lack expiry, or are renewed without user re-consent. The
 * rule is mostly manifest-centric — `manifest.web3.sessionKey` declares
 * the caveats — with two code-level checks for `requestPermissions` /
 * `wallet_requestPermissions` calls that omit an `expiry`.
 */

const RULE = "web3-session-key-erosion" as const;
const CATEGORY = "web3-session-key-erosion" as const;

/** Maximum allowed expiry window from "now" — 7 days, in seconds. */
const MAX_EXPIRY_WINDOW_SECONDS = 7 * 24 * 3600;

/**
 * Known-good caveat-enforcer / session-key validator addresses. The
 * vendor-verified delegation implementations from `delegate-targets.json`
 * (MetaMask Smart Account, Safe7702, Biconomy Nexus, ZeroDev Kernel) double
 * as the canonical caveat enforcers because in 7702-style delegation the
 * delegate code IS the caveat enforcer — it evaluates the caveats on-chain.
 * Addresses are stored lower-cased so matching is case-insensitive.
 *
 * NOTE: this allowlist is intentionally narrow. A skill using a fork or a
 * pre-release enforcer will still trip W09-007 — that's a documented signal
 * for manual review, not a hard block.
 */
const KNOWN_CAVEAT_ENFORCERS: Set<string> = new Set(
  (delegateTargets.delegates ?? [])
    .map((d) => (typeof d?.address === "string" ? d.address.toLowerCase() : ""))
    .filter((a): a is string => a.length > 0),
);

interface FindingDef {
  id: string;
  severity: SecurityFinding["severity"];
  title: string;
  description: string;
  remediation: string;
}

const DEFS: Record<string, FindingDef> = {
  "W09-001": {
    id: "W09-001",
    severity: "high",
    title: "Session key declared without expiry",
    description:
      "`manifest.web3.sessionKey` is declared but has no `expiry`. A session key without a hard deadline is effectively permanent — the user has no automatic way to revoke it, and a leaked key remains valid until the underlying account is upgraded or rotated.",
    remediation:
      "Set `web3.sessionKey.expiry` to a Unix timestamp no more than 7 days in the future. Re-prompt the user when the key expires rather than auto-renewing.",
  },
  "W09-002": {
    id: "W09-002",
    severity: "high",
    title: "Session key expiry is unbounded or beyond 7 days",
    description:
      "`manifest.web3.sessionKey.expiry` is `0` (no expiry) or sits more than 7 days in the future. Long-lived session keys widen the blast radius of any leak and bypass the user-consent loop the caveat system is meant to enforce.",
    remediation:
      "Cap the expiry at 7 days from `Date.now() / 1000`. Renewal must require fresh user re-consent — never extend a key automatically.",
  },
  "W09-003": {
    id: "W09-003",
    severity: "high",
    title: "Session key declared without a value limit",
    description:
      "`manifest.web3.sessionKey` is declared but has no `valueLimit`. Without a per-call or aggregate value cap, a compromised session key can drain the full balance of the underlying account.",
    remediation:
      "Set `web3.sessionKey.valueLimit` to the smallest amount the workflow actually needs (in wei, as a string). Combine with a `policy.dailyCap` for aggregate protection.",
  },
  "W09-004": {
    id: "W09-004",
    severity: "high",
    title: "Session key has no target-contract allowlist",
    description:
      "`manifest.web3.sessionKey.targets` is missing or empty. A session key that can call any contract is essentially a hot key — the caveat system is not constraining anything.",
    remediation:
      "List exact contract addresses in `web3.sessionKey.targets`. Prefer protocol-specific routers over open-ended adapters.",
  },
  "W09-005": {
    id: "W09-005",
    severity: "medium",
    title: "Session key has no function-selector allowlist",
    description:
      "`manifest.web3.sessionKey.selectors` is missing or empty. Restricting to specific 4-byte function selectors (e.g. `swapExactTokensForTokens`) is the strongest single defense against session-key abuse — without it, a target contract's full ABI is reachable.",
    remediation:
      'Pin the exact 4-byte selectors the skill needs in `web3.sessionKey.selectors` (e.g. `["0x38ed1739"]`).',
  },
  "W09-006": {
    id: "W09-006",
    severity: "medium",
    title: "Session key not pinned to specific chain IDs",
    description:
      "`manifest.web3.sessionKey.chainIds` is missing or empty. A session key valid across all chains can be replayed on a chain the user did not consent to — including testnets or forks where bridged assets behave differently.",
    remediation:
      "Set `web3.sessionKey.chainIds` to the exact list the skill needs (e.g. `[1, 8453]`). Cross-check with `web3.policy.allowedChains`.",
  },
  "W09-007": {
    id: "W09-007",
    severity: "medium",
    title: "Caveat enforcer not in known allowlist",
    description:
      "`manifest.web3.sessionKey.caveatEnforcer` references an address that is not in the v0 allowlist of recognised MetaMask Delegation Toolkit, Biconomy, ZeroDev, or Safe enforcers. An unknown enforcer might silently weaken or skip caveats — the address is what actually evaluates the rules on-chain.",
    remediation:
      "Use the canonical caveat-enforcer address for your delegation framework. If the enforcer is intentional, document its audit and request inclusion in the agentsec allowlist.",
  },
  "W09-010": {
    id: "W09-010",
    severity: "high",
    title: "requestPermissions call without nearby expiry",
    description:
      "Code calls `requestPermissions` / `wallet_requestPermissions` but no `expiry` or `expiration` token appears within ~500 characters of the call. Permissions requested without a stated lifetime are usually persistent — the wallet treats them as long-lived.",
    remediation:
      "Pass an `expiry` or `expiration` (Unix seconds, no more than 7 days out) in the permission request payload. Re-request rather than relying on cached approvals.",
  },
  "W09-011": {
    id: "W09-011",
    severity: "high",
    title: "requestPermissions call with null/undefined expiry",
    description:
      "Code calls `requestPermissions` while explicitly passing `expiry: undefined` or `expiry: null`. Most wallet implementations interpret a missing expiry as 'no expiration' — equivalent to a permanent grant.",
    remediation:
      "Pass a numeric Unix-second timestamp for `expiry`. Never let it be `null` or `undefined` — fail closed instead.",
  },
};

function buildManifestFinding(def: FindingDef, counter: number): SecurityFinding {
  return {
    id: `${def.id}-${counter}`,
    rule: RULE,
    severity: def.severity,
    category: CATEGORY,
    title: def.title,
    description: def.description,
    remediation: def.remediation,
  };
}

function buildCodeFinding(
  def: FindingDef,
  counter: number,
  file: SkillFile,
  index: number,
  evidence?: string,
): SecurityFinding {
  return {
    id: `${def.id}-${counter}`,
    rule: RULE,
    severity: def.severity,
    category: CATEGORY,
    title: def.title,
    description: def.description,
    file: file.relativePath,
    line: getLineNumber(file.content, index),
    evidence: evidence ?? getEvidenceLine(file.content, index),
    remediation: def.remediation,
  };
}

function checkManifest(
  sessionKey: NonNullable<Web3ManifestBlock["sessionKey"]>,
  findings: SecurityFinding[],
): void {
  // W09-001: missing expiry entirely
  if (sessionKey.expiry === undefined) {
    findings.push(buildManifestFinding(DEFS["W09-001"], findings.length + 1));
  } else if (typeof sessionKey.expiry === "number") {
    // W09-002: expiry === 0 (no expiry) OR more than 7 days from now
    const nowSec = Math.floor(Date.now() / 1000);
    if (sessionKey.expiry === 0 || sessionKey.expiry > nowSec + MAX_EXPIRY_WINDOW_SECONDS) {
      findings.push(buildManifestFinding(DEFS["W09-002"], findings.length + 1));
    }
  }

  // W09-003: missing valueLimit
  if (sessionKey.valueLimit === undefined) {
    findings.push(buildManifestFinding(DEFS["W09-003"], findings.length + 1));
  }

  // W09-004: missing or empty targets
  if (!sessionKey.targets || sessionKey.targets.length === 0) {
    findings.push(buildManifestFinding(DEFS["W09-004"], findings.length + 1));
  }

  // W09-005: missing or empty selectors
  if (!sessionKey.selectors || sessionKey.selectors.length === 0) {
    findings.push(buildManifestFinding(DEFS["W09-005"], findings.length + 1));
  }

  // W09-006: missing or empty chainIds
  if (!sessionKey.chainIds || sessionKey.chainIds.length === 0) {
    findings.push(buildManifestFinding(DEFS["W09-006"], findings.length + 1));
  }

  // W09-007: caveatEnforcer set but not in known allowlist
  if (
    sessionKey.caveatEnforcer !== undefined &&
    !KNOWN_CAVEAT_ENFORCERS.has(sessionKey.caveatEnforcer.toLowerCase())
  ) {
    findings.push(buildManifestFinding(DEFS["W09-007"], findings.length + 1));
  }
}

const NEARBY_EXPIRY_RE = /\b(?:expiry|expiration)\b/;
const NULLISH_EXPIRY_RE = /\bexpiry\s*:\s*(?:undefined|null)\b/;

function checkRequestPermissionsCalls(file: SkillFile, findings: SecurityFinding[]): void {
  REQUEST_PERMISSIONS_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = REQUEST_PERMISSIONS_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;

    const start = Math.max(0, match.index - 500);
    const end = Math.min(file.content.length, match.index + match[0].length + 500);
    const window = file.content.slice(start, end);

    // W09-011: explicit null/undefined expiry takes priority — fire before W09-010
    if (NULLISH_EXPIRY_RE.test(window)) {
      findings.push(buildCodeFinding(DEFS["W09-011"], findings.length + 1, file, match.index));
      continue;
    }

    // W09-010: no expiry/expiration token anywhere in the surrounding window
    if (!NEARBY_EXPIRY_RE.test(window)) {
      findings.push(buildCodeFinding(DEFS["W09-010"], findings.length + 1, file, match.index));
    }
  }
}

export function checkSessionKeys(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  const sessionKey = skill.manifest.web3?.sessionKey;
  if (sessionKey !== undefined) {
    checkManifest(sessionKey, findings);
  }

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    checkRequestPermissionsCalls(file, findings);
  }

  return findings;
}
