/**
 * Web3 capability detection.
 *
 * Static heuristics for "does this skill touch Web3?" — used by the CLI
 * to auto-apply the AST-10 Web3 Annex (`WEB3_RULES`) only to skills that
 * actually need it, and to tag them in the audit output.
 */

import type { AgentSkill } from "@agentsec/shared";
import {
  ADDRESS_RE,
  PERSONAL_SIGN_RE,
  REQUEST_PERMISSIONS_RE,
  SEND_RAW_TX_RE,
  SEND_TX_RE,
  SIGN_TX_RE,
  SIGN_TYPED_DATA_RE,
  shouldScanFile,
  WEB3_LIB_IMPORT_RE,
} from "./primitives/eth";

export interface Web3Detection {
  /**
   * True when the scanner should apply the AST-10 Web3 Annex rules to this
   * skill. `definite` and `likely` confidence levels both produce `true`;
   * `weak` and `no` produce `false` (the signal isn't strong enough to
   * justify running 12 extra rules with their false-positive surface).
   */
  isWeb3: boolean;
  /** Strongest signal class observed. */
  confidence: "definite" | "likely" | "weak" | "no";
  /** Human-readable list of signals that fired, in evaluation order. */
  signals: string[];
}

/**
 * RPC tool / method name regex. Wider than the rule-level patterns —
 * detection should fire on *any* mention, even ones the rules don't act on
 * (e.g. read-only `eth_chainId`).
 */
const RPC_TOOL_RE =
  /\b(?:eth_(?:sendTransaction|sign|signTypedData(?:_v[34])?|sendRawTransaction|call|getBalance|chainId|accounts|getTransactionByHash|estimateGas|gasPrice|blockNumber|getCode|getLogs|subscribe)|wallet_(?:requestPermissions|switchEthereumChain|addEthereumChain|getPermissions|watchAsset)|personal_sign)\b/g;

/**
 * Very-high-precision Web3 protocol / standard names. These are versioned
 * standards or named protocol primitives that do not occur in non-Web3
 * prose at meaningful rates: a single occurrence is enough to apply the
 * annex on its own.
 *
 * Includes: EIP/ERC/BIP-N versioned standards, Permit2/UniversalRouter/
 * Multicall3 named contracts, ERC-20/721/1155 token-standard variants, and
 * domain-bound product names (deckard.network, virtuals.io, x402, ACP).
 */
const VERY_SPECIFIC_PROTOCOL_RE =
  /\b(?:ERC[\s-]?\d{2,5}|EIP[\s-]?\d{2,5}|BIP[\s-]?\d{2,3}|x402|deckard\.network|virtuals(?:\.io)?|Agent\s+Commerce\s+Protocol|Permit2|UniversalRouter|Multicall3|Flashbots|MEV[\s-]?Blocker|gwei|seed\s+phrase|mnemonic\s+phrase|account\s+abstraction|stable\s?coin)\b/i;

/**
 * Lower-specificity Web3 prose. Words like "Solidity", "EVM",
 * "smart contract", or "Uniswap" can appear in CV-style skill descriptions
 * that are not actually Web3-touching. A match here counts as one signal,
 * which the detector requires to be paired with another before applying
 * the annex.
 */
const WEAK_PROTOCOL_RE =
  /\b(?:Uniswap|Aave|Lido|MakerDAO|Curve\s+Finance|Compound\s+Finance|Solidity|EVM(?:\s+chain)?|chainId|on[\s-]?chain|smart\s+contract|private\s+key|EOA|smart\s+account|gas\s+(?:limit|price)|tx\s+hash|transaction\s+hash|wallet\s+address|cryptocurrency)\b/i;

/** Weak-signal language used in skill descriptions and SKILL.md bodies. */
const ONCHAIN_LANG_RE =
  /\b(?:onchain|on-chain|blockchain|defi|nft|airdrop|chain\s*id|evm|layer-?2|rollup|bridge|wallet|signer|swap)\b/i;

const SOLIDITY_FILE_RE = /\.sol$/i;

/**
 * Description-level signals that a skill is itself a security / audit /
 * meta tool — one that *describes* Web3 patterns rather than performing
 * them. Used to suppress prose-based promotion: a skill whose SKILL.md
 * documents detection signals (`personal_sign`, `Permit2`, …) should not
 * be flagged as a Web3 skill on that basis alone. Code-level signals
 * (lib imports, `.sol` files, RPC calls in source) still promote.
 */
const META_TOOL_DESCRIPTION_RE =
  /\b(?:audit(?:ing|or|s)?|owasp|vulnerabilit(?:y|ies)|security\s+(?:scan|audit|review|tool|scanner|review)|skill\s+(?:audit|scan|review|scanner)|cve\b|sarif|policy\s+(?:engine|preset)|static\s+anal(?:ysis|yzer))\b/i;

/** Markdown / documentation file extensions. */
const MARKDOWN_RE = /\.(md|mdx)$/i;

/** Source-code extensions that count as real Web3 surface when present. */
const SOURCE_CODE_EXTS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "sol"]);

function hasExecutableSource(skill: AgentSkill): boolean {
  return skill.files.some((f) => {
    const ext = f.relativePath.split(".").pop()?.toLowerCase();
    return ext !== undefined && SOURCE_CODE_EXTS.has(ext);
  });
}

/**
 * Whether the skill is identifiable as a security / audit / meta tool.
 * Either an explicit opt-out via `metadata.agentsec.profile: "meta"` or
 * a description that matches the audit-tool keyword set.
 *
 * Meta tools that ALSO ship executable source code are *not* exempted:
 * actual `.ts`/`.js`/`.sol` code is treated as real Web3 surface, and a
 * tool that audits its own chain interactions still needs the annex.
 */
function isMetaSecurityTool(skill: AgentSkill): boolean {
  const metadata = skill.manifest.metadata as Record<string, unknown> | undefined;
  const agentsecMeta = metadata?.agentsec as Record<string, unknown> | undefined;
  if (agentsecMeta && agentsecMeta.profile === "meta") return true;

  if (hasExecutableSource(skill)) return false;

  const description = skill.manifest.description ?? "";
  return META_TOOL_DESCRIPTION_RE.test(description);
}

const RPC_PATTERNS = [
  SEND_TX_RE,
  SIGN_TX_RE,
  PERSONAL_SIGN_RE,
  SIGN_TYPED_DATA_RE,
  SEND_RAW_TX_RE,
  REQUEST_PERMISSIONS_RE,
  RPC_TOOL_RE,
];

function rpcReferenced(content: string): boolean {
  for (const re of RPC_PATTERNS) {
    re.lastIndex = 0;
    const hit = re.test(content);
    re.lastIndex = 0;
    if (hit) return true;
  }
  return false;
}

function libImportReferenced(content: string): boolean {
  WEB3_LIB_IMPORT_RE.lastIndex = 0;
  const hit = WEB3_LIB_IMPORT_RE.test(content);
  WEB3_LIB_IMPORT_RE.lastIndex = 0;
  return hit;
}

function veryStrongProtocolReferenced(content: string): boolean {
  return VERY_SPECIFIC_PROTOCOL_RE.test(content);
}

function weakProtocolReferenced(content: string): boolean {
  return WEAK_PROTOCOL_RE.test(content);
}

function ethAddressReferenced(content: string): boolean {
  ADDRESS_RE.lastIndex = 0;
  const hit = ADDRESS_RE.test(content);
  ADDRESS_RE.lastIndex = 0;
  return hit;
}

/**
 * Detect whether a skill is Web3-touching. Order of checks matches signal
 * strength: a definite signal short-circuits, otherwise we accumulate
 * likely/weak signals across the file set.
 *
 * Promotion rules:
 *   - `manifest.web3` block present                         → definite
 *   - `.sol` file present, OR a Web3 client library import  → likely (high precision)
 *   - any TWO of: RPC method ref, protocol/standard ref,
 *     Ethereum address                                       → likely
 *   - exactly one of: protocol/standard ref OR address       → weak (NOT applied)
 *   - description-only on-chain language                     → weak (NOT applied)
 *
 * The two-signal floor for code-content matches stops a single "Solidity"
 * mention in a CV-style description from triggering all 12 annex rules. A
 * lib import or `.sol` file is high-precision enough to stand alone.
 *
 * Meta-tool exemption: skills identified as security / audit tooling
 * (via `metadata.agentsec.profile: "meta"` or an audit-keyword description
 * on a markdown-only skill) have their `.md`/`.mdx` files excluded from
 * the signal pass. Such skills document Web3 patterns as detection
 * targets; firing the annex on their own docs is a false positive. Code
 * files (`.ts`, `.js`, `.sol`, …) still count — a meta tool that itself
 * touches chain still needs the annex.
 */
export function detectWeb3(skill: AgentSkill): Web3Detection {
  const signals: string[] = [];

  if (skill.manifest.web3 !== undefined) {
    signals.push("manifest declares `web3` block");
    return { isWeb3: true, confidence: "definite", signals };
  }

  const metaTool = isMetaSecurityTool(skill);

  let hasLib = false;
  let hasRpc = false;
  let hasSol = false;
  let hasVeryStrongProtocol = false;
  let hasWeakProtocol = false;
  let hasAddress = false;

  for (const file of skill.files) {
    if (SOLIDITY_FILE_RE.test(file.relativePath)) {
      hasSol = true;
    }
    if (!shouldScanFile(file.relativePath)) continue;
    // Meta / security-tooling skills (e.g. agentsec itself) document Web3
    // patterns in their SKILL.md/README as detection signals, not as
    // invocations. Skip markdown files for those skills so the prose
    // doesn't pump up the confidence; real code (.ts/.js/.sol) still counts.
    if (metaTool && MARKDOWN_RE.test(file.relativePath)) continue;
    if (!hasLib && libImportReferenced(file.content)) hasLib = true;
    if (!hasRpc && rpcReferenced(file.content)) hasRpc = true;
    if (!hasVeryStrongProtocol && veryStrongProtocolReferenced(file.content))
      hasVeryStrongProtocol = true;
    if (!hasWeakProtocol && weakProtocolReferenced(file.content)) hasWeakProtocol = true;
    if (!hasAddress && ethAddressReferenced(file.content)) hasAddress = true;
    if (hasLib && hasRpc && hasSol && hasVeryStrongProtocol && hasWeakProtocol && hasAddress) break;
  }

  if (metaTool && !hasLib && !hasRpc && !hasSol && !hasVeryStrongProtocol) {
    signals.push(
      "skill is security / audit tooling — markdown references documented as detection signals, not invocations",
    );
  }

  if (hasLib) signals.push("imports a Web3 client library (ethers/viem/web3/wagmi/…)");
  if (hasRpc) signals.push("references a Web3 RPC method");
  if (hasSol) signals.push("contains a Solidity (.sol) file");
  if (hasVeryStrongProtocol)
    signals.push("references a Web3 protocol or standard (ERC-N/EIP-N/Permit2/etc.)");
  if (hasWeakProtocol)
    signals.push("mentions generic Web3 prose (Solidity, EVM, smart contract, etc.)");
  if (hasAddress) signals.push("contains an Ethereum address");

  // High-precision singletons: any one alone justifies running the annex.
  // A library import or `.sol` file is unambiguously chain-related;
  // versioned-standard references (EIP-7702, ERC-8004, Permit2) and RPC
  // method names (`eth_sendTransaction`, `personal_sign`, etc.) do not
  // occur in non-Web3 contexts at meaningful rates.
  if (hasLib || hasSol || hasVeryStrongProtocol || hasRpc) {
    return { isWeb3: true, confidence: "likely", signals };
  }

  // Lower-precision signals: any two together promote, otherwise downgrade.
  // The pairing requirement stops a single CV-style "Solidity expertise"
  // mention from triggering the full 12-rule pack.
  const lowPrecisionCount = (hasWeakProtocol ? 1 : 0) + (hasAddress ? 1 : 0);
  if (lowPrecisionCount >= 2) {
    return { isWeb3: true, confidence: "likely", signals };
  }

  if (lowPrecisionCount === 1) {
    // Single weak hit — don't apply the annex but report the signal. The
    // `weak` confidence level is the seam where authors can opt in via
    // `--profile web3` to force application.
    return { isWeb3: false, confidence: "weak", signals };
  }

  // No code-level hits at all — fall back to documentation language.
  const langCorpus = [
    skill.manifest.description ?? "",
    ...skill.files.filter((f) => /SKILL\.md$|README/i.test(f.relativePath)).map((f) => f.content),
  ].join("\n");

  if (ONCHAIN_LANG_RE.test(langCorpus)) {
    signals.push("description / docs mention Web3 / blockchain language");
    return { isWeb3: false, confidence: "weak", signals };
  }

  return { isWeb3: false, confidence: "no", signals };
}
