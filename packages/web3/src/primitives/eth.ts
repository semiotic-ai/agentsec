/**
 * Shared regex primitives and small helpers for the AST-10 Web3 Annex
 * (`@agentsec/web3`). Centralized so every rule speaks the same language
 * about hex addresses, hashes, RPC URLs, and known contract names.
 *
 * Detection here is deliberately string/regex-level — the scanner does
 * not parse Solidity, EVM bytecode, or runtime EIP-712 payloads. Rules
 * that need richer reasoning use the manifest's `web3` block.
 */

/** 0x-prefixed 20-byte address. Case-insensitive. */
export const ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/g;

/** 0x-prefixed 32-byte hex (private keys, 32-byte hashes). */
export const HEX_32_RE = /\b(?:0x)?[a-fA-F0-9]{64}\b/g;

/** Possible BIP-39 mnemonic phrase: 12, 15, 18, 21, or 24 lowercase words. */
export const MNEMONIC_RE = /\b(?:[a-z]+\s){11,23}[a-z]+\b/g;

/** Common Web3 client library import detection. */
export const WEB3_LIB_IMPORT_RE =
  /(?:from\s+["']|require\s*\(\s*["'])(?:ethers|viem|web3|@wagmi\/core|@coinbase\/onchainkit|wagmi|@solana\/web3\.js|@privy-io|@biconomy|@zerodev)/g;

/**
 * RPC URL hosts used by typical agent skills. Used to detect hardcoded
 * provider URLs that should be indirected through an env var or registry.
 */
export const RPC_URL_RE =
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:infura\.io|alchemy\.com|quicknode\.com|ankr\.com|rpc\.tenderly\.co|drpc\.org|publicnode\.com|llamarpc\.com|polygon-rpc\.com|optimism\.io|arbitrum\.io|base\.org|bsc-dataseed\.bnbchain\.org)[^\s"'`]*/gi;

/** Function selectors / call patterns the scanner cares about. */
export const SEND_TX_RE = /\beth_sendTransaction\b|\.sendTransaction\s*\(/g;
export const SIGN_TX_RE = /\bsignTransaction\b|\.signTransaction\s*\(/g;
export const PERSONAL_SIGN_RE = /\beth_sign\b|\bpersonal_sign\b|\.personalSign\s*\(/g;
export const SIGN_TYPED_DATA_RE = /\beth_signTypedData(?:_v[34])?\b|\.signTypedData\s*\(/g;
export const SEND_RAW_TX_RE = /\beth_sendRawTransaction\b|\.sendRawTransaction\s*\(/g;
export const REQUEST_PERMISSIONS_RE = /\b(?:wallet_requestPermissions|requestPermissions)\b/g;

/**
 * Permit2 canonical address (single deployment across all chains).
 * Used by AST-W02 to recognize Permit2 EIP-712 domains.
 */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * EIP-7702 delegation indicator prefix. The 23-byte
 * delegation designator stored in account code starts with these
 * three bytes.
 */
export const EIP7702_DESIGNATOR_PREFIX = "0xef0100";

/** EIP-7702 transaction type byte. */
export const EIP7702_TX_TYPE = "0x04";

/** Cross-chain message bus / bridge libraries the scanner recognises. */
export const BRIDGE_LIB_RE =
  /\b(?:LayerZero|wormhole|hyperlane|axelar|stargate|across|debridge|connext|synapse|nomad|cBridge)\b|\bccipReceive\b|\bsend\s*\(\s*[^)]*dst(?:ChainId|Eid)\b/gi;

/** Token approval patterns relevant to AST-W01 / AST-W02. */
export const APPROVE_RE = /\.(?:approve|increaseAllowance)\s*\(/g;
export const MAX_UINT_RE =
  /(?:type\s*\(\s*uint256\s*\)\s*\.\s*max|2\s*\*\*\s*256\s*-\s*1|(?:0x)?[fF]{64})/;

/**
 * Walk a string body and check whether the given index sits inside a
 * line / block / hash comment. Mirrors `packages/scanner/src/rules/utils.ts`
 * so that web3 rules behave consistently with the base AST10 rule pack.
 */
export function isInComment(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineUpToMatch = content.slice(lineStart, index);
  if (/\/\//.test(lineUpToMatch)) return true;
  if (/^\s*#/.test(content.slice(lineStart, index + 10))) return true;
  const before = content.slice(Math.max(0, index - 500), index);
  const lastBlockOpen = before.lastIndexOf("/*");
  const lastBlockClose = before.lastIndexOf("*/");
  if (lastBlockOpen > lastBlockClose) return true;
  return false;
}

/**
 * Whether `index` sits inside a fenced markdown code block (``` or ~~~).
 *
 * Counts opening/closing fence lines that appear before `index`; an odd
 * count means we are inside an unclosed block. Treats lines that begin
 * with up to three spaces of indentation followed by ``` or ~~~ as a
 * fence (matching CommonMark's allowance for fence indentation).
 */
export function isInFencedCodeBlock(content: string, index: number): boolean {
  let fenceCount = 0;
  let lineStart = 0;
  for (let i = 0; i <= index && i < content.length; i++) {
    if (i === index || content[i] === "\n") {
      const lineEnd = content[i] === "\n" ? i : i;
      const line = content.slice(lineStart, lineEnd);
      if (/^[ \t]{0,3}(?:```|~~~)/.test(line)) fenceCount++;
      if (content[i] === "\n") lineStart = i + 1;
      if (i === index) break;
    }
  }
  return fenceCount % 2 === 1;
}

/**
 * Whether the byte index falls in markdown narrative prose — outside any
 * fenced code block — for files with a markdown extension. Returns false
 * for non-markdown files so callers can apply this unconditionally.
 *
 * Use this in code-pattern rules (e.g. swap-call detection, hardcoded RPC
 * URLs) to suppress matches that hit English sentences in `.md`/`.mdx`
 * documentation. Without this guard the regex `\\bswap\\s*\\(` matches
 * the phrase "Execute a swap (with confirmation pattern)" in a README
 * line and fires a critical-severity false positive.
 */
export function isInProse(filePath: string, content: string, index: number): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext !== "md" && ext !== "mdx") return false;
  return !isInFencedCodeBlock(content, index);
}

/** 1-based line number for a character index in a string body. */
export function getLineNumber(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/** Trimmed text of the line containing `index`. */
export function getEvidenceLine(content: string, index: number): string {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  let lineEnd = content.indexOf("\n", index);
  if (lineEnd === -1) lineEnd = content.length;
  return content.slice(lineStart, lineEnd).trim();
}

/**
 * Redact key-shaped substrings inside a piece of evidence text. The Web3
 * annex emits the line that triggered a detection so reviewers can act,
 * but for AST-W11 (key material) we MUST NOT echo the literal value into
 * machine-readable reports — JSON/SARIF artifacts get checked into CI and
 * security dashboards. The text terminal preview is a separate concern;
 * rules call this for any field that flows to the report layer.
 *
 * Replaces:
 *   - 0x-prefixed 64-char hex (private keys, 32-byte secrets) with `0x[REDACTED-32B]`
 *   - bare 64-char hex with `[REDACTED-32B]`
 *   - 12+-word lowercase phrases (BIP-39 shape) with `[REDACTED-MNEMONIC]`
 * Other evidence bytes are preserved so the rule's signal remains useful.
 */
export function redactKeyMaterial(evidence: string): string {
  if (!evidence) return evidence;
  let out = evidence;
  out = out.replace(/0x[a-fA-F0-9]{64}\b/g, "0x[REDACTED-32B]");
  out = out.replace(/\b[a-fA-F0-9]{64}\b/g, "[REDACTED-32B]");
  out = out.replace(/\b(?:[a-z]+\s){11,23}[a-z]+\b/g, "[REDACTED-MNEMONIC]");
  return out;
}

/** File extensions the Web3 annex scans for code-style detections. */
const SCANNABLE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "sol",
  "json",
  "yaml",
  "yml",
  "md",
  "mdx",
  "toml",
]);

/** Whether the scanner should walk this file's content for regex rules. */
export function shouldScanFile(relativePath: string): boolean {
  const ext = relativePath.split(".").pop()?.toLowerCase() ?? "";
  return SCANNABLE_EXTENSIONS.has(ext);
}

/**
 * Lower-cased equality check for a hex address. The `eth` libraries
 * routinely return checksummed strings; rule authors compare normalized
 * forms via this helper rather than re-implementing ad-hoc lowercasing.
 */
export function eqAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
