import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import delegateData from "../data/delegate-targets.json";
import {
  ADDRESS_RE,
  EIP7702_DESIGNATOR_PREFIX,
  eqAddress,
  getEvidenceLine,
  getLineNumber,
  isInComment,
  shouldScanFile,
} from "../primitives/eth";

const RULE = "web3-eip7702-delegation";
const CATEGORY = "web3-eip7702-delegation" as const;

const SET_CODE_AUTH_RE =
  /SetCodeAuthorization|setCodeAuthorization|signAuthorization|eth_signAuthorization|tx\.type\s*=\s*['"]?0x04|type\s*:\s*['"]?(?:0x)?04['"]?|authorizationList\s*[:=]/g;

const CHAIN_ID_ZERO_RE = /chainId\s*:\s*0[\s,}]|chain_id\s*=\s*0[\s,]/;

const REVOKE_OR_EXPIRY_RE = /\b(?:revokeAfter|expiry|expiresAt|expireAt|deadline)\b/;

const PROSE_HINT_RE = /\b(?:wallet upgrade|gas sponsorship|smart account install)\b/i;

const ALLOWED_DELEGATES: readonly string[] = delegateData.delegates.map((d) => d.address);

function isAllowedDelegate(address: string): boolean {
  return ALLOWED_DELEGATES.some((allowed) => eqAddress(allowed, address));
}

/**
 * Look for a 20-byte hex address near (same or adjacent line) the
 * SetCodeAuthorization match. Returns the first address found within
 * a small window, or null if none is present.
 */
function findNearbyDelegateAddress(
  content: string,
  matchIndex: number,
  matchEnd: number,
): string | null {
  const lineStart = content.lastIndexOf("\n", matchIndex) + 1;
  const nextNewline = content.indexOf("\n", matchEnd);
  const adjacentEnd = nextNewline === -1 ? content.length : content.indexOf("\n", nextNewline + 1);
  const windowEnd = adjacentEnd === -1 ? content.length : adjacentEnd;
  const window = content.slice(lineStart, windowEnd);

  ADDRESS_RE.lastIndex = 0;
  const m = ADDRESS_RE.exec(window);
  return m ? m[0] : null;
}

function hasNearbyExpiry(content: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - 500);
  const end = Math.min(content.length, matchIndex + 500);
  return REVOKE_OR_EXPIRY_RE.test(content.slice(start, end));
}

function checkManifest(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counterRef: { n: number },
): void {
  const web3 = skill.manifest.web3;
  if (web3?.signs7702 !== true) return;

  const policy = web3.policy;
  const hasAllowedContracts =
    Array.isArray(policy?.allowedContracts) && policy.allowedContracts.length > 0;
  const hasExpiry = policy?.expiry !== undefined;

  if (!hasAllowedContracts && !hasExpiry) {
    counterRef.n++;
    findings.push({
      id: `W03-001-${counterRef.n}`,
      rule: RULE,
      severity: "critical",
      category: CATEGORY,
      title: "EIP-7702 signing declared without delegate allowlist or expiry",
      description:
        "The skill declares web3.signs7702 = true but provides neither web3.policy.allowedContracts nor web3.policy.expiry. A 7702 SetCodeAuthorization without scoped delegate targets and a time bound can install attacker-controlled code on the EOA and silently drain tokens, NFTs, and approvals.",
      remediation:
        "Populate web3.policy.allowedContracts with the exact, vendor-verified delegate implementations the skill may install, and set web3.policy.expiry to a short window. Reject any 7702 authorization whose `address` field is not in the allowlist or whose validity exceeds the expiry.",
    });
  }
}

function checkFile(
  file: SkillFile,
  skill: AgentSkill,
  findings: SecurityFinding[],
  counterRef: { n: number },
): void {
  const content = file.content;

  SET_CODE_AUTH_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = SET_CODE_AUTH_RE.exec(content)) !== null) {
    if (isInComment(content, match.index)) continue;

    const matchEnd = match.index + match[0].length;
    const delegate = findNearbyDelegateAddress(content, match.index, matchEnd);
    if (delegate && !isAllowedDelegate(delegate)) {
      counterRef.n++;
      findings.push({
        id: `W03-002-${counterRef.n}`,
        rule: RULE,
        severity: "critical",
        category: CATEGORY,
        title: "EIP-7702 authorization targets unknown delegate implementation",
        description: `The skill constructs an EIP-7702 SetCodeAuthorization pointing at ${delegate}, which is not on the vendor-verified delegate allowlist. Installing unaudited delegate code on the user's EOA gives the contract full custody of the account: it can batch-drain tokens, NFTs, and outstanding approvals in a single transaction.`,
        file: file.relativePath,
        line: getLineNumber(content, match.index),
        evidence: getEvidenceLine(content, match.index),
        remediation:
          "Restrict 7702 delegate targets to the vendor-verified set in @agentsec/web3 (MetaMask Smart Account, Safe7702, Biconomy Nexus, ZeroDev Kernel). Compare the authorization `address` against this allowlist before signing, and reject anything else.",
      });
    }

    const blockStart = Math.max(0, match.index - 200);
    const blockEnd = Math.min(content.length, match.index + 500);
    const block = content.slice(blockStart, blockEnd);
    if (CHAIN_ID_ZERO_RE.test(block)) {
      counterRef.n++;
      findings.push({
        id: `W03-003-${counterRef.n}`,
        rule: RULE,
        severity: "high",
        category: CATEGORY,
        title: "EIP-7702 authorization is cross-chain replayable (chainId = 0)",
        description:
          "The skill constructs an EIP-7702 authorization with chainId = 0. Per EIP-7702, chainId = 0 makes the authorization valid on every chain the EOA exists on, so a single signature can be replayed to install attacker code across all chains where the user holds assets.",
        file: file.relativePath,
        line: getLineNumber(content, match.index),
        evidence: getEvidenceLine(content, match.index),
        remediation:
          "Always set chainId to the specific target chain. Never sign 7702 authorizations with chainId = 0 unless you have explicitly verified that universal cross-chain delegation is the intended behavior.",
      });
    }

    if (!hasNearbyExpiry(content, match.index)) {
      counterRef.n++;
      findings.push({
        id: `W03-005-${counterRef.n}`,
        rule: RULE,
        severity: "high",
        category: CATEGORY,
        title: "EIP-7702 authorization has no revokeAfter or expiry",
        description:
          "The skill constructs an EIP-7702 SetCodeAuthorization without a nearby revokeAfter / expiry / deadline field. 7702 delegations persist on the EOA until explicitly revoked, so an authorization signed once can be replayed or remain active indefinitely after the legitimate session ends.",
        file: file.relativePath,
        line: getLineNumber(content, match.index),
        evidence: getEvidenceLine(content, match.index),
        remediation:
          "Pair every 7702 authorization with a revokeAfter / expiry timestamp and have the skill issue a revoking authorization (delegating back to address(0)) when the window closes.",
      });
    }
  }

  let designatorIdx = content.indexOf(EIP7702_DESIGNATOR_PREFIX);
  while (designatorIdx !== -1) {
    if (!isInComment(content, designatorIdx)) {
      counterRef.n++;
      findings.push({
        id: `W03-004-${counterRef.n}`,
        rule: RULE,
        severity: "medium",
        category: CATEGORY,
        title: "Manual EIP-7702 designator prefix detected",
        description:
          "The skill references the literal 0xef0100 — the EIP-7702 delegation designator prefix that EVM nodes use to mark account code as a delegation pointer. Manually constructing this prefix bypasses library-level validation; small mistakes can install delegations to attacker-controlled addresses.",
        file: file.relativePath,
        line: getLineNumber(content, designatorIdx),
        evidence: getEvidenceLine(content, designatorIdx),
        remediation:
          "Prefer a vetted library (viem `signAuthorization`, ethers v6 `Authorization`) which assembles the designator and signature for you. If you must construct the prefix manually, add unit tests that round-trip through a node's getCode response.",
      });
    }
    designatorIdx = content.indexOf(EIP7702_DESIGNATOR_PREFIX, designatorIdx + 1);
  }

  if (skill.manifest.web3?.signs7702 !== true) {
    PROSE_HINT_RE.lastIndex = 0;
    const hint = PROSE_HINT_RE.exec(content);
    if (hint && !isInComment(content, hint.index)) {
      counterRef.n++;
      findings.push({
        id: `W03-010-${counterRef.n}`,
        rule: RULE,
        severity: "medium",
        category: CATEGORY,
        title: "Skill prose mentions wallet upgrade flow but signs7702 is undeclared",
        description:
          "The skill body references a 'wallet upgrade', 'gas sponsorship', or 'smart account install' flow — common cover stories for malicious EIP-7702 delegation prompts — but the manifest does not declare web3.signs7702. Operators reviewing the manifest cannot tell that the skill will ask for a 7702 authorization.",
        file: file.relativePath,
        line: getLineNumber(content, hint.index),
        evidence: getEvidenceLine(content, hint.index),
        remediation:
          "If the skill genuinely upgrades wallets via 7702, set web3.signs7702 = true in the manifest and populate web3.policy.allowedContracts and web3.policy.expiry. If it does not, rewrite the prose to remove the 7702-adjacent vocabulary.",
      });
    }
  }
}

export function checkEip7702(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const counterRef = { n: 0 };

  checkManifest(skill, findings, counterRef);

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    checkFile(file, skill, findings, counterRef);
  }

  return findings;
}
