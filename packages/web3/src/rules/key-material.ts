import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import {
  getEvidenceLine,
  getLineNumber,
  HEX_32_RE,
  isInComment,
  MNEMONIC_RE,
  redactKeyMaterial,
  shouldScanFile,
} from "../primitives/eth";

/**
 * Wrap `getEvidenceLine` so AST-W11 evidence is automatically redacted
 * before it reaches the SecurityFinding object. Reports (JSON/SARIF/HTML)
 * persist evidence verbatim — leaking the raw key would defeat the rule.
 */
function safeEvidence(content: string, index: number): string {
  return redactKeyMaterial(getEvidenceLine(content, index));
}

/**
 * Rule: AST-W11 — Key Material in Agent Memory / Logs.
 *
 * Detects private keys, mnemonics, or session-key signers loaded into
 * the agent process's address space, written to chain-of-thought traces,
 * included in tool-call arguments that get logged, or persisted in
 * conversation history.
 *
 * Detections:
 *   W11-001  64-char hex inside a `console.log` / `logger.*` / template
 *            literal that gets logged.                          critical
 *   W11-002  64-char hex on the RHS of a string assignment.     high
 *   W11-003  `const PRIVATE_KEY = "0x..."` style literal.       critical
 *   W11-010  Inline BIP-39-shaped mnemonic phrase.              critical
 *   W11-020  `process.env.PRIVATE_KEY` (or similar) referenced
 *            in a log/tool argument.                            high
 *   W11-021  `JSON.stringify` of an object containing a signer
 *            field (`privateKey`/`mnemonic`/`seed`/`signer`).    high
 *   W11-030  Manifest `secrets` entry without `redactInTrace`.  medium
 *   W11-040  `signer.signTransaction(...)` followed by a log of
 *            the signer or tx within ~200 chars.                high
 */

const RULE = "web3-key-material-leak";
const CATEGORY = "web3-key-material-leak" as const;

/**
 * Tiny inline list of common BIP-39 words. The full list is 2048 entries —
 * a small whitelist of prefixes is enough to cut prose false positives,
 * since legitimate mnemonics contain only words from the list.
 */
const COMMON_BIP39_WORDS = new Set<string>([
  "abandon",
  "ability",
  "able",
  "about",
  "above",
  "absent",
  "absorb",
  "abstract",
  "absurd",
  "abuse",
  "access",
  "accident",
  "account",
  "accuse",
  "achieve",
  "acid",
  "acoustic",
  "acquire",
  "across",
  "act",
  "action",
  "actor",
  "actress",
  "actual",
  "adapt",
  "add",
  "addict",
  "address",
  "adjust",
  "admit",
  "adult",
  "advance",
  "advice",
  "aerobic",
  "affair",
  "afford",
  "afraid",
  "again",
  "age",
  "agent",
  "agree",
  "ahead",
  "aim",
  "air",
  "airport",
  "aisle",
  "alarm",
  "album",
  "alcohol",
  "alert",
  "alien",
]);

const ENV_KEY_NAMES = ["PRIVATE_KEY", "MNEMONIC", "SEED_PHRASE", "WALLET_KEY"];
const SIGNER_FIELD_NAMES = ["privateKey", "mnemonic", "seed", "signer"];

/** Look for log-shaped sinks on a line: console.*, logger*, or a template literal. */
function isLoggingLine(line: string): boolean {
  if (/\bconsole\s*\.\s*(?:log|info|debug|warn|error|trace)\s*\(/.test(line)) return true;
  if (/\b(?:logger|log)\s*\.\s*[a-zA-Z]+\s*\(/.test(line)) return true;
  if (/`[^`]*\$\{[^}]*\}/.test(line)) return true;
  return false;
}

/**
 * Heuristic: is the matched 64-char hex shaped like a public key reference?
 * We look back up to 20 chars on the same line for a `pubkey`/`publicKey`/`addr`
 * token. Public Ethereum keys are 64 bytes uncompressed (128 hex chars), but
 * 32-byte forms are common in Solana / X25519, so we whitelist those tokens.
 */
function looksLikePublicKey(line: string, matchOffsetInLine: number): boolean {
  const start = Math.max(0, matchOffsetInLine - 20);
  const window = line.slice(start, matchOffsetInLine);
  return /\b(?:pubkey|publicKey|publickey|pub_key|addr|address|hash|txHash|tx_hash|blockHash|block_hash)\b/i.test(
    window,
  );
}

/** True if the matched hex is a `const NAME = "0x..."`-style assignment of a key. */
function isKeyConstAssignment(line: string): boolean {
  return /\b(?:const|let|var)\s+[A-Z_][A-Z0-9_]*(?:KEY|MNEMONIC|SEED|SECRET)[A-Z0-9_]*\s*=\s*["'`]/.test(
    line,
  );
}

/** True if the matched hex sits on the RHS of any string assignment. */
function isStringAssignment(line: string, matchOffsetInLine: number): boolean {
  const before = line.slice(0, matchOffsetInLine);
  return /=\s*["'`][^"'`]*$/.test(before);
}

interface PushArgs {
  id: string;
  severity: SecurityFinding["severity"];
  title: string;
  description: string;
  remediation: string;
  file?: SkillFile;
  line?: number;
  evidence?: string;
}

function makeFinding(counter: number, args: PushArgs): SecurityFinding {
  return {
    id: `${args.id}-${counter}`,
    rule: RULE,
    severity: args.severity,
    category: CATEGORY,
    title: args.title,
    description: args.description,
    file: args.file?.relativePath,
    line: args.line,
    evidence: args.evidence,
    remediation: args.remediation,
  };
}

/** Scan a single file's textual content for hex / mnemonic / env / stringify leaks. */
function checkFileContent(file: SkillFile, findings: SecurityFinding[], start: number): number {
  let counter = start;
  const content = file.content;
  const lines = content.split("\n");

  // ---- W11-001..003: 64-char hex in code ---------------------------------
  HEX_32_RE.lastIndex = 0;
  let hexMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((hexMatch = HEX_32_RE.exec(content)) !== null) {
    const idx = hexMatch.index;
    if (isInComment(content, idx)) continue;

    const lineStart = content.lastIndexOf("\n", idx) + 1;
    let lineEnd = content.indexOf("\n", idx);
    if (lineEnd === -1) lineEnd = content.length;
    const line = content.slice(lineStart, lineEnd);
    const offsetInLine = idx - lineStart;

    if (looksLikePublicKey(line, offsetInLine)) continue;

    const lineNo = getLineNumber(content, idx);
    const evidence = safeEvidence(content, idx);

    if (isKeyConstAssignment(line)) {
      counter++;
      findings.push(
        makeFinding(counter, {
          id: "W11-003",
          severity: "critical",
          title: "Private-key constant declared inline",
          description:
            "A 64-character hex value is bound to a constant whose name suggests key material (PRIVATE_KEY, SECRET, MNEMONIC). Keys that live in source are leaked the moment the file is committed, copied to a sandbox, or shipped in a build artifact.",
          remediation:
            "Load key material from a secrets manager / KMS / TEE at runtime. Never embed keys in source. If this hex is a non-secret constant, rename it to remove key-shaped tokens or move it out of the source tree.",
          file,
          line: lineNo,
          evidence,
        }),
      );
      continue;
    }

    if (isLoggingLine(line)) {
      counter++;
      findings.push(
        makeFinding(counter, {
          id: "W11-001",
          severity: "critical",
          title: "64-character hex on a log/template-literal line",
          description:
            "A value that is byte-shaped like a private key or 32-byte secret appears on a line that logs to console, a logger, or interpolates into a template literal. Anything written to console is captured by the LLM's chain-of-thought trace and forwarded to provider servers.",
          remediation:
            "Redact key-shaped values before logging. Wrap the logger so any 64-char hex is replaced with `***`. Never interpolate a signer or its outputs into a template literal that flows to chat history or a tool response.",
          file,
          line: lineNo,
          evidence,
        }),
      );
      continue;
    }

    if (isStringAssignment(line, offsetInLine)) {
      counter++;
      findings.push(
        makeFinding(counter, {
          id: "W11-002",
          severity: "high",
          title: "64-character hex assigned to a string variable",
          description:
            "A 64-character hex literal is assigned into a string. Any variable holding raw key material widens the blast radius — it can be serialized, logged, or returned from a tool call without the author noticing.",
          remediation:
            "Hold key material in a typed wrapper (`Signer`, `KMSHandle`) that refuses to stringify. Load from a secrets manager rather than hardcoding hex.",
          file,
          line: lineNo,
          evidence,
        }),
      );
    }
  }

  // ---- W11-010: BIP-39 mnemonic phrase -----------------------------------
  MNEMONIC_RE.lastIndex = 0;
  let mnemMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((mnemMatch = MNEMONIC_RE.exec(content)) !== null) {
    const idx = mnemMatch.index;
    if (isInComment(content, idx)) continue;
    const phrase = mnemMatch[0];
    const words = phrase.trim().split(/\s+/);
    if (words.length < 11) continue;
    let knownWords = 0;
    for (const w of words) {
      if (COMMON_BIP39_WORDS.has(w)) knownWords++;
    }
    if (knownWords < 4) continue;

    counter++;
    findings.push(
      makeFinding(counter, {
        id: "W11-010",
        severity: "critical",
        title: "Likely BIP-39 mnemonic phrase in source",
        description:
          "A 12+ word lowercase phrase whose words look like BIP-39 entries appears in source. A mnemonic in the agent's address space — let alone its source tree — is full custody of every wallet derived from it.",
        remediation:
          "Remove the phrase from source. Rotate the wallet immediately if this commit was ever pushed. Load mnemonics from a hardware-backed secret store and decrypt only inside a TEE.",
        file,
        line: getLineNumber(content, idx),
        evidence: safeEvidence(content, idx),
      }),
    );
  }

  // ---- W11-020: process.env.PRIVATE_KEY referenced in a log/tool arg -----
  for (const envName of ENV_KEY_NAMES) {
    const envRe = new RegExp(`process\\.env\\.${envName}\\b`, "g");
    let envMatch: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
    while ((envMatch = envRe.exec(content)) !== null) {
      const idx = envMatch.index;
      if (isInComment(content, idx)) continue;
      const lineNo = getLineNumber(content, idx);
      const line = lines[lineNo - 1] ?? "";
      if (!isLoggingLine(line)) continue;

      counter++;
      findings.push(
        makeFinding(counter, {
          id: "W11-020",
          severity: "high",
          title: `process.env.${envName} flows into a log or tool argument`,
          description: `\`process.env.${envName}\` is referenced on a line that logs or interpolates the value. Even if the env var stays out of source, reading it into a logged context defeats the secrecy boundary — the value ends up in chain-of-thought traces, MCP transcripts, or LLM-provider request logs.`,
          remediation:
            "Read secrets through a wrapper (e.g., `getSecret('PRIVATE_KEY')`) that returns an opaque handle and refuses to stringify. Audit every callsite to ensure the raw value never reaches a log line, error message, or tool argument.",
          file,
          line: lineNo,
          evidence: safeEvidence(content, idx),
        }),
      );
    }
  }

  // ---- W11-021: JSON.stringify of object with signer-ish fields ----------
  const stringifyRe = /JSON\s*\.\s*stringify\s*\(/g;
  let strMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((strMatch = stringifyRe.exec(content)) !== null) {
    const idx = strMatch.index;
    if (isInComment(content, idx)) continue;
    const window = content.slice(idx, Math.min(content.length, idx + 400));
    const argEnd = findMatchingParen(window);
    const argText = argEnd > 0 ? window.slice(0, argEnd) : window;

    let hit: string | null = null;
    for (const name of SIGNER_FIELD_NAMES) {
      const fieldRe = new RegExp(`\\b${name}\\b`);
      if (fieldRe.test(argText)) {
        hit = name;
        break;
      }
    }
    if (!hit) continue;

    counter++;
    findings.push(
      makeFinding(counter, {
        id: "W11-021",
        severity: "high",
        title: `JSON.stringify on object containing \`${hit}\``,
        description: `\`JSON.stringify\` was called on an object that exposes a \`${hit}\` field. Once the signer is rendered as JSON it lands in logs, error reports, or LLM tool-call arguments verbatim.`,
        remediation:
          "Define a `toJSON` on signer wrappers that returns a redacted shape (`{ kind: 'signer', address }`). For ad-hoc objects, build a sanitized projection before stringifying.",
        file,
        line: getLineNumber(content, idx),
        evidence: safeEvidence(content, idx),
      }),
    );
  }

  // ---- W11-040: signTransaction followed by a log of signer/tx -----------
  const signRe = /\bsigner\s*\.\s*signTransaction\s*\(/g;
  let signMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((signMatch = signRe.exec(content)) !== null) {
    const idx = signMatch.index;
    if (isInComment(content, idx)) continue;
    const start = Math.max(0, idx - 200);
    const end = Math.min(content.length, idx + 200);
    const surrounding = content.slice(start, end);
    if (!/console\s*\.\s*log\s*\([^)]*(?:signer|tx)\b/.test(surrounding)) continue;

    counter++;
    findings.push(
      makeFinding(counter, {
        id: "W11-040",
        severity: "high",
        title: "Signer or signed transaction logged near signTransaction call",
        description:
          "A `signer.signTransaction(...)` call is colocated with a `console.log` that includes the signer or the transaction object. A signed tx envelope contains the v/r/s components — which, while not the key itself, leak as much as the key for that nonce and feed replay tooling.",
        remediation:
          "Drop the log line. If you need observability, log the tx hash only after the tx is broadcast, never the signer reference or the raw RLP envelope.",
        file,
        line: getLineNumber(content, idx),
        evidence: safeEvidence(content, idx),
      }),
    );
  }

  return counter;
}

/** Walk parenthesis-balanced text starting at index 0; return the close index or -1. */
function findMatchingParen(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Manifest pass: AST-W11-030 — declared secrets without redactInTrace. */
function checkManifestSecrets(
  skill: AgentSkill,
  findings: SecurityFinding[],
  start: number,
): number {
  let counter = start;
  const raw = (skill.manifest as Record<string, unknown>).secrets;
  if (!Array.isArray(raw)) return counter;

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    if (obj.redactInTrace === true) continue;
    const name =
      typeof obj.name === "string" ? obj.name : typeof obj.id === "string" ? obj.id : "<unnamed>";

    counter++;
    findings.push(
      makeFinding(counter, {
        id: "W11-030",
        severity: "medium",
        title: `Manifest secret \`${name}\` missing redactInTrace`,
        description: `The manifest declares a secret \`${name}\` without \`redactInTrace: true\`. The runtime should treat declared secrets as opaque in any traces that flow to LLM providers; absent that flag, the value can be interpolated into logs and tool-call payloads.`,
        remediation: `Set \`redactInTrace: true\` on every entry of the \`secrets\` array. Reject secrets at load time if the flag is missing.`,
      }),
    );
  }

  return counter;
}

export function checkKeyMaterial(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    counter = checkFileContent(file, findings, counter);
  }

  counter = checkManifestSecrets(skill, findings, counter);

  return findings;
}
