import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import protectedRpcs from "../data/protected-rpcs.json" with { type: "json" };
import {
  getEvidenceLine,
  getLineNumber,
  isInComment,
  RPC_URL_RE,
  SEND_RAW_TX_RE,
  shouldScanFile,
} from "../primitives/eth";

/**
 * Rule: RPC Endpoint Substitution & Mempool Leakage (AST-W05)
 *
 * Detects skills that hardcode or accept RPC URLs an attacker could
 * substitute (typo-squatted domains, env-var injection, malicious MCP
 * config), or that broadcast to a public mempool when a private/protected
 * RPC was warranted.
 */

interface ProtectedRpcEntry {
  name: string;
  url: string;
  chainId: number;
}

const PROTECTED_RPC_URLS: Set<string> = new Set(
  (protectedRpcs.endpoints as ProtectedRpcEntry[]).map((e) => normalizeUrl(e.url)),
);

const PROTECTED_RPC_HOSTS: Set<string> = new Set(
  (protectedRpcs.endpoints as ProtectedRpcEntry[]).map((e) => extractHost(e.url)),
);

const RULE_ID = "web3-rpc-substitution";
const CATEGORY = "web3-rpc-substitution" as const;

const ENV_RPC_RE = /process\.env\.(?:[A-Z0-9_]*RPC[A-Z0-9_]*|RPC_URL)\b/g;
const CHAIN_ID_CHECK_RE = /\beth_chainId\b|\bgetChainId\s*\(|\bgetNetwork\s*\(/;
const PROTECTED_RPC_REFERENCE_RE =
  /\b(?:flashbots|mevblocker|blxrbdn|edennetwork|eth-protect|rpc\.flashbots\.net|rpc\.mevblocker\.io)\b/i;
const EMBEDDED_KEY_RE = /\/[a-zA-Z0-9_-]{20,}(?:[/?#]|$)/;

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase();
}

function extractHost(url: string): string {
  const match = url.match(/^https?:\/\/([^/?#]+)/i);
  return (match?.[1] ?? url).toLowerCase();
}

function isProtectedRpc(url: string): boolean {
  const trimmed = url.replace(/[)"'`,;]+$/, "");
  const normalized = normalizeUrl(trimmed);
  if (PROTECTED_RPC_URLS.has(normalized)) return true;
  const host = extractHost(trimmed);
  return PROTECTED_RPC_HOSTS.has(host);
}

function hasEmbeddedApiKey(url: string): boolean {
  const trimmed = url.replace(/[)"'`,;]+$/, "");
  const hostMatch = trimmed.match(/^https?:\/\/[^/?#]+/i);
  if (!hostMatch) return false;
  const afterHost = trimmed.slice(hostMatch[0].length);
  return EMBEDDED_KEY_RE.test(afterHost);
}

function collectRpcUrls(file: SkillFile): { url: string; index: number }[] {
  const urls: { url: string; index: number }[] = [];
  RPC_URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = RPC_URL_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    urls.push({ url: match[0], index: match.index });
  }
  return urls;
}

function pushFinding(
  findings: SecurityFinding[],
  counterRef: { n: number },
  baseId: string,
  severity: SecurityFinding["severity"],
  title: string,
  description: string,
  remediation: string,
  file?: string,
  line?: number,
  evidence?: string,
): void {
  counterRef.n++;
  findings.push({
    id: `${baseId}-${counterRef.n}`,
    rule: RULE_ID,
    severity,
    category: CATEGORY,
    title,
    description,
    file,
    line,
    evidence,
    remediation,
  });
}

function checkHardcodedUrls(
  file: SkillFile,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const urls = collectRpcUrls(file);
  for (const { url, index } of urls) {
    const line = getLineNumber(file.content, index);
    const evidence = getEvidenceLine(file.content, index);

    if (hasEmbeddedApiKey(url)) {
      pushFinding(
        findings,
        counter,
        "W05-001",
        "high",
        "Hardcoded RPC URL with embedded API key",
        "An RPC endpoint is hardcoded with an embedded API key. Anyone with read access to the source can exfiltrate the key and impersonate the skill's RPC traffic, enabling response substitution and rate-limit hijacking.",
        "Move the API key to an environment variable or secret manager and reference it through a pinned RPC registry. Rotate the leaked key immediately.",
        file.relativePath,
        line,
        evidence,
      );
      continue;
    }

    if (!isProtectedRpc(url)) {
      // W05-002 is the *substitution* signal — a hardcoded URL anywhere in
      // source is a typo-squat / supply-chain-pin-replacement target, but
      // it is NOT inherently a sandwich risk (most read-only Alchemy/Infura
      // calls are fine on a public mempool). The high-severity broadcast
      // case is covered by W05-003 below. Keep this at low so the rule
      // doesn't drown out real findings on every legitimate Alchemy URL.
      pushFinding(
        findings,
        counter,
        "W05-002",
        "low",
        "Hardcoded RPC URL — substitution-attack target",
        "An RPC endpoint is hardcoded in source. Hardcoded providers are easy substitution targets (typo-squatting, supply-chain pin replacement, malicious MCP config). For value-bearing broadcasts, see also AST-W05-003 which covers protected-RPC requirements.",
        "Move the URL to a pinned `manifest.web3.rpcRegistry` and resolve it at runtime. The registry is the single seam an attacker has to compromise rather than every callsite.",
        file.relativePath,
        line,
        evidence,
      );
    }
  }
}

function hasProtectedRpcReference(skill: AgentSkill): boolean {
  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    if (PROTECTED_RPC_REFERENCE_RE.test(file.content)) return true;
  }
  const registry = skill.manifest.web3?.rpcRegistry;
  if (typeof registry === "string" && PROTECTED_RPC_REFERENCE_RE.test(registry)) return true;
  return false;
}

function checkPublicMempoolBroadcast(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  if (hasProtectedRpcReference(skill)) return;

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    SEND_RAW_TX_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
    while ((match = SEND_RAW_TX_RE.exec(file.content)) !== null) {
      if (isInComment(file.content, match.index)) continue;
      pushFinding(
        findings,
        counter,
        "W05-003",
        "high",
        "Public-mempool broadcast — sandwich exposure",
        "The skill broadcasts raw transactions via `eth_sendRawTransaction` and no protected-RPC reference (Flashbots Protect, MEV Blocker, bloXroute Protect, Eden Network) appears anywhere in the skill. Public-mempool broadcasts expose users to sandwich and front-running MEV.",
        "Route value-bearing transactions through a protected RPC and declare it under `manifest.web3.rpcRegistry`. For non-value calls, document the broadcast path explicitly.",
        file.relativePath,
        getLineNumber(file.content, match.index),
        getEvidenceLine(file.content, match.index),
      );
    }
  }
}

function checkEnvRpcWithoutChainCheck(
  file: SkillFile,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  ENV_RPC_RE.lastIndex = 0;
  const hasChainCheck = CHAIN_ID_CHECK_RE.test(file.content);
  if (hasChainCheck) return;

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = ENV_RPC_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    pushFinding(
      findings,
      counter,
      "W05-004",
      "medium",
      "RPC URL from environment without chainId integrity check",
      "The skill reads its RPC URL from `process.env` but does not cross-check the resolved network via `eth_chainId` / `getChainId` / `getNetwork`. An attacker who controls the env (malicious MCP config, supply-chain pin replacement, container hijack) can silently redirect the skill to a hostile chain.",
      "After resolving the RPC URL, query `eth_chainId` and assert it matches the value declared in `manifest.web3.chains` before broadcasting any transaction.",
      file.relativePath,
      getLineNumber(file.content, match.index),
      getEvidenceLine(file.content, match.index),
    );
    return;
  }
}

function checkManifestChainsWithoutRegistry(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const web3 = skill.manifest.web3;
  if (!web3) return;
  const chains = web3.chains;
  if (!Array.isArray(chains) || chains.length === 0) return;
  if (typeof web3.rpcRegistry === "string" && web3.rpcRegistry.length > 0) return;

  pushFinding(
    findings,
    counter,
    "W05-010",
    "low",
    "Manifest declares chains without an RPC registry",
    "`manifest.web3.chains` is declared but `manifest.web3.rpcRegistry` is missing. Without a pinned registry, the skill's RPC origin is implicit and trivially substitutable at deploy time.",
    "Add `manifest.web3.rpcRegistry` pointing at a signed or content-addressed registry that maps each declared chainId to a vetted endpoint.",
  );
}

function checkMultiProviderSprawl(
  file: SkillFile,
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  if (typeof skill.manifest.web3?.rpcRegistry === "string") return;

  const urls = collectRpcUrls(file);
  if (urls.length === 0) return;

  const providersByLine = new Map<number, { host: string; index: number; line: number }>();
  for (const { url, index } of urls) {
    const host = extractHost(url);
    const provider = host.split(".").slice(-2).join(".");
    if (!providersByLine.has(index)) {
      providersByLine.set(index, {
        host: provider,
        index,
        line: getLineNumber(file.content, index),
      });
    }
  }

  const distinctProviders = new Set(Array.from(providersByLine.values()).map((p) => p.host));
  if (distinctProviders.size <= 2) return;

  const first = Array.from(providersByLine.values())[0];
  pushFinding(
    findings,
    counter,
    "W05-011",
    "low",
    "Multi-provider sprawl — pin via registry",
    `The file references ${distinctProviders.size} distinct RPC providers without an \`rpcRegistry\` declaration in the manifest. Sprawling provider lists make substitution attacks easier and complicate incident response when one provider is compromised.`,
    "Consolidate RPC endpoints behind `manifest.web3.rpcRegistry` and reference them by chainId. Failover should be expressed in the registry, not as inline URL literals.",
    file.relativePath,
    first.line,
    getEvidenceLine(file.content, first.index),
  );
}

export function checkRpc(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const counter = { n: 0 };

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    checkHardcodedUrls(file, findings, counter);
    checkEnvRpcWithoutChainCheck(file, findings, counter);
    checkMultiProviderSprawl(file, skill, findings, counter);
  }

  checkPublicMempoolBroadcast(skill, findings, counter);
  checkManifestChainsWithoutRegistry(skill, findings, counter);

  return findings;
}
