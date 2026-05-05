import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import knownContractsData from "../data/known-contracts.json" with { type: "json" };
import {
  ADDRESS_RE,
  getEvidenceLine,
  getLineNumber,
  isInComment,
  shouldScanFile,
} from "../primitives/eth";

/**
 * Rule: AST-W06 — Unverified Contract Call Targets ("Calldata Confusion")
 *
 * Detects skills that build `to + calldata` from model output, MCP tool
 * results, or untrusted user input without validating the destination is
 * the contract it claims to be. Address-poisoning (recent-tx history) is
 * the same family.
 */

interface KnownContract {
  name: string;
  address: string;
  chainId?: number;
}

interface KnownContractsFile {
  contracts: KnownContract[];
}

const KNOWN_CONTRACTS: KnownContract[] = (knownContractsData as KnownContractsFile).contracts;

const PROTOCOL_NAMES: { name: string; addresses: string[] }[] = [
  {
    name: "Permit2",
    addresses: KNOWN_CONTRACTS.filter((c) => /^Permit2/i.test(c.name)).map((c) =>
      c.address.toLowerCase(),
    ),
  },
  {
    name: "Multicall3",
    addresses: KNOWN_CONTRACTS.filter((c) => /^Multicall3/i.test(c.name)).map((c) =>
      c.address.toLowerCase(),
    ),
  },
  { name: "Uniswap", addresses: [] },
  { name: "UniversalRouter", addresses: [] },
];

const RULE = "web3-contract-targets" as const;
const CATEGORY = "web3-contract-targets" as const;

const TO_FROM_MODEL_RE =
  /to\s*:\s*\$\{[^}]*\b(?:input|user|response|message|completion|reply|args)\b|to\s*=\s*(?:input|user|response|message|completion|reply|args)\b/g;

const LOWERCASE_COMPARE_RE = /\.toLowerCase\(\)\s*===|\.toLowerCase\(\)\s*==/g;

const RESOLVE_NAME_RE = /\.resolveName\s*\(|\bensRegistry\b|\bnamehash\s*\(/g;
const REVERSE_RESOLVE_RE = /\blookupAddress\s*\(|\breverseResolve\b/;

const ADDRESS_LITERAL_LINE_RE = /0x[a-fA-F0-9]{40}/;

const ADDRESS_POISONING_MD_RE =
  /\b(?:transaction history|recent transactions|previous transfer)\b/gi;

const TX_HISTORY_CODE_RE = /\btx\.history\b|\bgetTransactions\s*\(|\beth_getTransactionByHash\b/g;

const ALLOWLIST_HINT_RE = /\b(?:allow[Ll]ist|allowed[A-Z]\w*|whitelist|isAllowed|inAllowlist)\b/;

interface FindingDef {
  id: string;
  severity: SecurityFinding["severity"];
  title: string;
  description: string;
  remediation: string;
}

const DEFS: Record<string, FindingDef> = {
  "W06-001": {
    id: "W06-001",
    severity: "high",
    title: "Contract target derived from model output",
    description:
      "The transaction destination (`to`) is interpolated from a model-, MCP-, or user-supplied variable. An attacker who controls that variable can redirect the call to a malicious contract, even if the calldata looks correct.",
    remediation:
      "Resolve targets from a static allowlist (`manifest.web3.policy.allowedContracts`) keyed by chainId. Never let model output choose `to`.",
  },
  "W06-002": {
    id: "W06-002",
    severity: "medium",
    title: "Checksum-naive address compare — use getAddress()",
    description:
      "An address is being compared via `.toLowerCase() ===`. Lowercasing strips EIP-55 information and is a common source of mismatched-address bugs (and address-spoofing tricks that abuse capitalization).",
    remediation:
      "Compare addresses via `viem.getAddress(a) === viem.getAddress(b)` or `ethers.getAddress`, which both validate the checksum and normalize.",
  },
  "W06-003": {
    id: "W06-003",
    severity: "medium",
    title: "ENS forward-resolution without reverse-resolution",
    description:
      "The skill resolves an ENS name to an address but never reverse-resolves to confirm the address still maps back to that name. Dangling ENS records or attacker-controlled subdomains can swap the resolved address out from under the agent.",
    remediation:
      "After `resolveName`, call `lookupAddress` on the returned address and assert the round-trip equals the original name. Pin a fallback address for high-value calls.",
  },
  "W06-004": {
    id: "W06-004",
    severity: "medium",
    title: "Named-protocol call lacks address pin",
    description:
      "Code references a well-known protocol by name (Uniswap, UniversalRouter, Multicall3, Permit2) without a pinned address constant in the surrounding source. Without a pin, the skill is trusting whatever address the model or RPC returns.",
    remediation:
      "Pin the canonical address as a constant alongside the protocol name and assert `getAddress(target) === PINNED_ADDR` before sending the transaction.",
  },
  "W06-010": {
    id: "W06-010",
    severity: "medium",
    title: "Address-poisoning attack surface — recent-tx history is untrusted",
    description:
      "The skill documentation describes the agent picking destination addresses from transaction history, recent transactions, or previous transfers. Address-poisoning attacks place look-alike addresses into a victim's history precisely so this kind of agent picks them.",
    remediation:
      "Treat tx history as untrusted. Require an explicit user-confirmed allowlist or a checksum-verified directory (ENS, contracts.json) for transfer destinations.",
  },
  "W06-011": {
    id: "W06-011",
    severity: "low",
    title: "Address extracted from tx history without allowlist check",
    description:
      "The skill extracts `to`/`from` addresses from `tx.history`, `getTransactions`, or `eth_getTransactionByHash` results without an explicit allowlist check. This is the implementation-level twin of W06-010.",
    remediation:
      "Validate the extracted address against `manifest.web3.policy.allowedContracts` (or an equivalent static list) before reusing it as a transaction destination.",
  },
};

function buildFinding(
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

function isCodeFile(file: SkillFile): boolean {
  const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
  return ["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "sol"].includes(ext);
}

function isMarkdownFile(file: SkillFile): boolean {
  const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
  return ext === "md" || ext === "mdx";
}

function scanModelOutputTo(file: SkillFile, findings: SecurityFinding[]): void {
  TO_FROM_MODEL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = TO_FROM_MODEL_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    findings.push(buildFinding(DEFS["W06-001"], findings.length + 1, file, match.index));
  }
}

function scanLowercaseCompare(file: SkillFile, findings: SecurityFinding[]): void {
  LOWERCASE_COMPARE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = LOWERCASE_COMPARE_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    const lineStart = file.content.lastIndexOf("\n", match.index) + 1;
    const lineEnd = file.content.indexOf("\n", match.index);
    const line = file.content.slice(lineStart, lineEnd === -1 ? file.content.length : lineEnd);
    if (!ADDRESS_LITERAL_LINE_RE.test(line)) continue;
    findings.push(buildFinding(DEFS["W06-002"], findings.length + 1, file, match.index));
  }
}

function scanEnsResolution(file: SkillFile, findings: SecurityFinding[]): void {
  if (REVERSE_RESOLVE_RE.test(file.content)) return;
  RESOLVE_NAME_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = RESOLVE_NAME_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    findings.push(buildFinding(DEFS["W06-003"], findings.length + 1, file, match.index));
  }
}

function scanNamedProtocolWithoutPin(file: SkillFile, findings: SecurityFinding[]): void {
  const content = file.content;
  for (const proto of PROTOCOL_NAMES) {
    const re = new RegExp(`\\b${proto.name}\\b`, "g");
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
    while ((match = re.exec(content)) !== null) {
      if (isInComment(content, match.index)) continue;
      const start = Math.max(0, match.index - 300);
      const end = Math.min(content.length, match.index + match[0].length + 300);
      const window = content.slice(start, end);
      const addrMatches = window.match(ADDRESS_RE) ?? [];
      const hasPin =
        proto.addresses.length === 0
          ? addrMatches.length > 0
          : addrMatches.some((a) => proto.addresses.includes(a.toLowerCase()));
      if (hasPin) continue;
      findings.push(buildFinding(DEFS["W06-004"], findings.length + 1, file, match.index));
    }
  }
}

function scanAddressPoisoningMd(file: SkillFile, findings: SecurityFinding[]): void {
  ADDRESS_POISONING_MD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = ADDRESS_POISONING_MD_RE.exec(file.content)) !== null) {
    findings.push(buildFinding(DEFS["W06-010"], findings.length + 1, file, match.index));
  }
}

function scanTxHistoryExtract(file: SkillFile, findings: SecurityFinding[]): void {
  if (ALLOWLIST_HINT_RE.test(file.content)) return;
  TX_HISTORY_CODE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = TX_HISTORY_CODE_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    findings.push(buildFinding(DEFS["W06-011"], findings.length + 1, file, match.index));
  }
}

export function checkContractTargets(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;

    if (isCodeFile(file)) {
      scanModelOutputTo(file, findings);
      scanLowercaseCompare(file, findings);
      scanEnsResolution(file, findings);
      scanNamedProtocolWithoutPin(file, findings);
      scanTxHistoryExtract(file, findings);
    }

    if (isMarkdownFile(file)) {
      scanAddressPoisoningMd(file, findings);
    }
  }

  return findings;
}
