import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import permit2Spenders from "../data/permit2-spenders.json" with { type: "json" };
import {
  getEvidenceLine,
  getLineNumber,
  isInComment,
  PERMIT2_ADDRESS,
  SIGN_TYPED_DATA_RE,
  shouldScanFile,
} from "../primitives/eth";

/**
 * Rule: AST-W02 — Implicit Permit / Permit2 Signature Capture
 *
 * Detects skills that surface EIP-712 signing UX where the underlying
 * payload is an ERC-2612 `permit()` or a Uniswap Permit2 PermitSingle/
 * PermitBatch granting unbounded allowance to an attacker-controlled
 * spender. The user trusts the agent's framing of what they're signing,
 * so a misleading prompt becomes a one-signature drain.
 */

interface SpenderEntry {
  name: string;
  address: string;
  chainId: number;
}

const ALLOWED_SPENDERS: Set<string> = new Set(
  (permit2Spenders.spenders as SpenderEntry[]).map((s) => s.address.toLowerCase()),
);

const PERMIT2_ADDRESS_LOWER = PERMIT2_ADDRESS.toLowerCase();

const PERMIT2_LITERAL_RE = new RegExp(PERMIT2_ADDRESS.replace(/^0x/, "0x"), "gi");

const PERMIT_KEYWORD_RE = /\b(?:PermitSingle|PermitBatch|permit2)\b/i;

const UNBOUNDED_AMOUNT_RE =
  /\bamount\s*:\s*(?:["'`]?(?:2\s*\*\*\s*256\s*-\s*1|0x[fF]{64}|MAX_UINT256|type\s*\(\s*uint256\s*\)\s*\.\s*max)["'`]?|BigInt\s*\(\s*["']?0x[fF]{64}["']?\s*\)|ethers\.MaxUint256|maxUint256)/;

const PERMIT_PRIMARY_TYPE_RE = /primaryType\s*:\s*['"]Permit(?:Single|Batch)?['"]/;

const TAINTED_VARS = new Set([
  "input",
  "user",
  "request",
  "params",
  "body",
  "args",
  "response",
  "completion",
]);

const SPENDER_TEMPLATE_RE = /spender\s*:\s*[`"']?\s*\$\{([^}]+)\}/g;
const SPENDER_VAR_RE = /spender\s*:\s*([a-zA-Z_]\w*)(?:\s*[,}])/g;

const SOLIDITY_PERMIT_DEADLINE_RE =
  /permit\s*\([^)]*deadline\s*[,:]\s*(?:type\s*\(\s*uint256\s*\)\s*\.\s*max|2\s*\*\*\s*256|0xff{8,})/i;

const PERMIT_MENTION_RE = /\b(?:permit|gasless\s+approval)\b/i;

const MANIFEST_FILE_RE = /(?:^|\/)(?:SKILL\.md|skill\.md|manifest\.json|claw\.json)$/i;

/**
 * Tokens that signal an address literal sits in a fee-recipient / affiliate
 * position. Matched within a small line-window around the address. The list
 * is intentionally narrow — generic words like "to" or "address" appear in
 * non-fee contexts (router targets, vaults), so we restrict to tokens that
 * unambiguously imply someone other than the user receives a cut.
 */
const FEE_TOKENS_RE =
  /\b(?:fee|feeBps|feeRecipient|swapFeeRecipient|swapFeeBps|affiliate|referrer|partner|takerFee|protocolFee|skimRecipient|treasury)\b/i;
const ADDRESS_LITERAL_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const FEE_CONTEXT_LINES = 3;
/** Recognized burn / null sinks. Hardcoded fees to these are not a skim. */
const FEE_NULL_SINKS = new Set<string>([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

function findAllMatches(content: string, regex: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = re.exec(content)) !== null) {
    matches.push(match);
    if (match.index === re.lastIndex) re.lastIndex++;
  }
  return matches;
}

function fileMentionsAllowedSpender(content: string): boolean {
  const lower = content.toLowerCase();
  for (const addr of ALLOWED_SPENDERS) {
    if (lower.includes(addr)) return true;
  }
  return false;
}

function checkPermit2AddressUsage(
  file: SkillFile,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const matches = findAllMatches(file.content, PERMIT2_LITERAL_RE);
  if (matches.length === 0) return;

  const hasSignTypedData = SIGN_TYPED_DATA_RE.test(file.content);
  SIGN_TYPED_DATA_RE.lastIndex = 0;
  if (!hasSignTypedData) return;

  const allowlisted = fileMentionsAllowedSpender(file.content);
  if (allowlisted) return;

  for (const match of matches) {
    if (isInComment(file.content, match.index)) continue;
    if (match[0].toLowerCase() !== PERMIT2_ADDRESS_LOWER) continue;

    counter.n++;
    findings.push({
      id: `W02-001-${counter.n}`,
      rule: "web3-permit-capture",
      severity: "critical",
      category: "web3-permit-capture",
      title: "Permit2 EIP-712 signature flow without spender allowlist",
      description:
        "This file references the canonical Permit2 contract address and triggers an EIP-712 signTypedData prompt, but no recognized Permit2 spender (e.g., Uniswap UniversalRouter, 0x Settler) appears in the same file. A malicious skill can frame the signature as a benign approval while the underlying PermitSingle/PermitBatch grants an attacker-controlled spender unbounded allowance over the user's tokens.",
      file: file.relativePath,
      line: getLineNumber(file.content, match.index),
      evidence: getEvidenceLine(file.content, match.index),
      remediation:
        "Pin the Permit2 spender to a vetted contract from `web3.policy.allowedContracts` in SKILL.md. Display the resolved spender, token, amount, and deadline to the user before signing. Reject any spender that is not on the curated allowlist (see `data/permit2-spenders.json`).",
    });
  }
}

function checkUnboundedPermitAmount(
  file: SkillFile,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  if (!PERMIT_KEYWORD_RE.test(file.content)) return;

  const lines = file.content.split("\n");
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = UNBOUNDED_AMOUNT_RE.exec(line);
    if (match) {
      const absIndex = cursor + match.index;
      if (!isInComment(file.content, absIndex)) {
        counter.n++;
        findings.push({
          id: `W02-002-${counter.n}`,
          rule: "web3-permit-capture",
          severity: "critical",
          category: "web3-permit-capture",
          title: "Unbounded Permit/Permit2 amount",
          description:
            "A Permit, PermitSingle, or PermitBatch payload requests the maximum uint256 allowance. Once signed, the spender can drain the entire token balance — including future deposits — without further user interaction. Unbounded permits eliminate any blast-radius cap on a compromised relayer or spender.",
          file: file.relativePath,
          line: i + 1,
          evidence: line.trim(),
          remediation:
            "Bound the permit `amount` to the exact value the user is authorizing for this transaction. Use a tight `expiration` / `deadline` (minutes, not years) and surface both values in the signing prompt.",
        });
      }
    }
    cursor += line.length + 1;
  }
}

function checkTaintedSpender(
  file: SkillFile,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  if (!PERMIT_PRIMARY_TYPE_RE.test(file.content)) return;
  if (!SIGN_TYPED_DATA_RE.test(file.content)) {
    SIGN_TYPED_DATA_RE.lastIndex = 0;
    return;
  }
  SIGN_TYPED_DATA_RE.lastIndex = 0;

  const reportTainted = (matchIndex: number, matchText: string, varName: string): void => {
    if (isInComment(file.content, matchIndex)) return;
    if (!TAINTED_VARS.has(varName)) return;
    counter.n++;
    findings.push({
      id: `W02-003-${counter.n}`,
      rule: "web3-permit-capture",
      severity: "high",
      category: "web3-permit-capture",
      title: "Permit spender bound to model/user-controlled variable",
      description: `The Permit EIP-712 message uses a spender derived from an untrusted source ('${varName}'). A model-supplied or user-supplied spender lets an attacker substitute their own address into the signed allowance, converting a legitimate-looking signature into an arbitrary token grant.`,
      file: file.relativePath,
      line: getLineNumber(file.content, matchIndex),
      evidence: matchText.trim(),
      remediation:
        "Resolve the spender from a static manifest allowlist (`web3.policy.allowedContracts`) before constructing the EIP-712 payload. Never interpolate model output, request bodies, or user input into the `spender` field.",
    });
  };

  for (const m of findAllMatches(file.content, SPENDER_TEMPLATE_RE)) {
    const inner = m[1].trim();
    const baseVar = inner.split(/[.\s[]/)[0];
    reportTainted(m.index, getEvidenceLine(file.content, m.index), baseVar);
  }

  for (const m of findAllMatches(file.content, SPENDER_VAR_RE)) {
    reportTainted(m.index, getEvidenceLine(file.content, m.index), m[1]);
  }
}

function checkSolidityPermitDeadline(
  file: SkillFile,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const lines = file.content.split("\n");
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = SOLIDITY_PERMIT_DEADLINE_RE.exec(line);
    if (match) {
      const absIndex = cursor + match.index;
      if (!isInComment(file.content, absIndex)) {
        counter.n++;
        findings.push({
          id: `W02-004-${counter.n}`,
          rule: "web3-permit-capture",
          severity: "high",
          category: "web3-permit-capture",
          title: "ERC-2612 permit() with effectively infinite deadline",
          description:
            "An ERC-2612 `permit()` call sets `deadline` to type(uint256).max (or equivalent), making the signature replayable for the lifetime of the chain. Once captured, an attacker can replay the permit at any future point — for example, after the user's balance grows.",
          file: file.relativePath,
          line: i + 1,
          evidence: line.trim(),
          remediation:
            "Set `deadline` to a tight window (commonly `block.timestamp + 600`). Reject permit signatures with deadlines further out than a few minutes from the user's signing moment.",
        });
      }
    }
    cursor += line.length + 1;
  }
}

function manifestDeclaresAllowedContracts(skill: AgentSkill): boolean {
  const allow = skill.manifest.web3?.policy?.allowedContracts;
  return Array.isArray(allow) && allow.length > 0;
}

function checkManifestPermitWithoutAllowlist(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  if (manifestDeclaresAllowedContracts(skill)) return;

  let mentionsPermit = false;
  let manifestMentions = false;

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    if (!PERMIT_MENTION_RE.test(file.content)) continue;
    mentionsPermit = true;
    if (MANIFEST_FILE_RE.test(file.relativePath)) {
      manifestMentions = true;
      break;
    }
  }

  if (!mentionsPermit) return;

  const description = manifestMentions
    ? "The skill's SKILL.md / manifest mentions 'permit' or 'gasless approval' but does not declare a `web3.policy.allowedContracts` allowlist. Without a curated list of acceptable spenders, the runtime cannot reject malicious Permit2 targets."
    : "The skill describes 'permit' or 'gasless approval' flows but its manifest does not declare a `web3.policy.allowedContracts` allowlist. Permit signatures should always be checked against a vetted spender list at signing time.";

  counter.n++;
  findings.push({
    id: `W02-010-${counter.n}`,
    rule: "web3-permit-capture",
    severity: "medium",
    category: "web3-permit-capture",
    title: "Permit/gasless flow without policy.allowedContracts",
    description,
    remediation:
      "Add a `web3.policy.allowedContracts` array to SKILL.md listing every legitimate Permit2 spender (e.g., Uniswap UniversalRouter, 0x Settler) the skill may target. The runtime must reject signatures whose spender is not on this list.",
  });
}

/**
 * Detects "documented zero" fee disclaimers like `feeBps = 0` or
 * `SWAP_FEE_BPS=0`. Suppresses the common pattern where a skill ships a
 * configurable fee but defaults to no skim — the address literal is still
 * present (often an EOA address used elsewhere) but its fee charge is
 * genuinely zero.
 */
const ZERO_FEE_DISCLAIMER_RE =
  /\b(?:fee|feeBps|swapFeeBps|takerFee|protocolFee)\w*\s*[:=]\s*['"]?0['"]?(?![\w.])/i;

function detectFeeSkim(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const allowlistArray = skill.manifest.web3?.policy?.allowedContracts ?? [];
  const allowlist = new Set<string>(allowlistArray.map((a) => a.toLowerCase()));

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    const lines = file.content.split("\n");
    let cursor = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineMatches = [...line.matchAll(ADDRESS_LITERAL_RE)];
      if (lineMatches.length === 0) {
        cursor += line.length + 1;
        continue;
      }

      const windowStart = Math.max(0, i - FEE_CONTEXT_LINES);
      const windowEnd = Math.min(lines.length, i + FEE_CONTEXT_LINES + 1);
      const context = lines.slice(windowStart, windowEnd).join("\n");
      if (!FEE_TOKENS_RE.test(context)) {
        cursor += line.length + 1;
        continue;
      }

      // "fee = 0" disclaimer anywhere in the context window suppresses the
      // address — the literal is benign because no skim is being captured.
      if (ZERO_FEE_DISCLAIMER_RE.test(context)) {
        cursor += line.length + 1;
        continue;
      }

      for (const m of lineMatches) {
        const addr = m[0].toLowerCase();
        if (FEE_NULL_SINKS.has(addr)) continue;
        if (allowlist.has(addr)) continue;
        // Permit2 itself is the verifying contract, not a fee recipient.
        if (addr === PERMIT2_ADDRESS_LOWER) continue;
        const absIndex = cursor + (m.index ?? 0);
        if (isInComment(file.content, absIndex)) continue;

        counter.n++;
        findings.push({
          id: `W02-005-${counter.n}`,
          rule: "web3-permit-capture",
          severity: "critical",
          category: "web3-permit-capture",
          title: "Hardcoded fee recipient in Permit2/swap typed-data",
          description:
            "An address literal appears within a fee/affiliate/referrer context but is not declared in `web3.policy.allowedContracts`. Skills that bake a hardcoded fee recipient + bps into Permit2 typed-data silently capture a cut of every signature for a third party. Users blind-sign the EIP-712 message expecting a swap and authorize a skim they never see.",
          file: file.relativePath,
          line: i + 1,
          evidence: line.trim(),
          remediation:
            "Either remove the fee recipient entirely or add it to `web3.policy.allowedContracts` in SKILL.md so the runtime can attest the skim is intentional. Surface the recipient and fee bps to the user before signing — never embed them silently in EIP-712 typed-data.",
        });
      }

      cursor += line.length + 1;
    }
  }
}

export function checkPermit2(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const counter = { n: 0 };

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    checkPermit2AddressUsage(file, findings, counter);
    checkUnboundedPermitAmount(file, findings, counter);
    checkTaintedSpender(file, findings, counter);
    checkSolidityPermitDeadline(file, findings, counter);
  }

  checkManifestPermitWithoutAllowlist(skill, findings, counter);
  detectFeeSkim(skill, findings, counter);

  return findings;
}
