import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import {
  getEvidenceLine,
  getLineNumber,
  isInComment,
  isInProse,
  shouldScanFile,
} from "../primitives/eth";

/**
 * Rule: AST-W10 — Slippage / Oracle Manipulation by Agent Loop.
 *
 * The skill executes trades or liquidations using on-chain prices it
 * queries itself (via `getReserves`, `slot0`, oracle reads) without TWAP
 * or off-chain corroboration. An attacker can pre-position to manipulate
 * the spot price between the agent's read and the agent's swap, with
 * the agent's own retry/refresh loop making the manipulation cheaper.
 *
 * Detections cover:
 *  - Quote-then-swap atomically in the same trust domain (W10-001).
 *  - Swap calls without a `minAmountOut` / `amountOutMin` / `minOut`
 *    visible in the call argument list (W10-002).
 *  - String-literal slippage values that are too loose (>5%) (W10-003)
 *    or sourced from model-supplied variables (W10-004).
 *  - Excessive deadlines (W10-005).
 *  - Swap calls inside polling loops (W10-006).
 *  - Manifest-level signals: trade-like actions without an oracle
 *    declaration (W10-010), or `oracle.type === "spot"` (W10-011).
 */

const QUOTE_RE = /\b(?:getReserves|slot0|getAmountsOut|quoteExactInputSingle)\s*\(/g;
/**
 * Specific router/pool swap entrypoints. These names are unambiguous code
 * patterns; matches in any context (code or prose) indicate a swap call.
 */
const SWAP_SPECIFIC_RE =
  /\b(?:swapExactTokens(?:For(?:Tokens|ETH)(?:SupportingFeeOnTransferTokens)?)?|swapExactETH(?:ForTokens(?:SupportingFeeOnTransferTokens)?)?|exactInput(?:Single)?|exactOutput(?:Single)?)\s*\(/g;
/**
 * Generic `swap(` — matches function-call-shaped tokens but also matches
 * English prose like "execute a swap (state-changing)". Callers must
 * suppress these matches in markdown narrative via {@link isInProse} and
 * confirm the surrounding source looks like code, not documentation.
 */
const SWAP_GENERIC_RE = /\bswap\s*\(/g;
const SWAP_KEYWORDS_RE = /\b(?:swapExactTokens|swapExactETH|exactInput|exactOutput|swap\s*\()/;
const MIN_OUT_RE = /\b(?:minAmountOut|amountOutMin|minOut|amountOutMinimum)\b/;
const SLIPPAGE_LITERAL_RE =
  /slippage\s*[:=]\s*(?:['"](\d+(?:\.\d+)?)['"]|(\d+(?:\.\d+)?))(?!\s*[a-zA-Z_])/g;
const SLIPPAGE_VARIABLE_RE = /slippage\s*[:=]\s*((?:[A-Za-z_$][\w$]*\.)+[A-Za-z_$][\w$]*)/g;
const DEADLINE_RE = /deadline\s*[:=]\s*[^,)]*\+\s*(\d+)/g;
const SETINTERVAL_RE = /\bsetInterval\s*\(/g;
const TRADE_ACTIONS = new Set(["swap", "trade", "buy", "sell", "liquidate", "rebalance"]);

interface Manifest {
  actions?: unknown;
  web3?: {
    oracle?: { source?: string; type?: string };
  };
}

interface PreparedFinding {
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
  file?: string;
  line?: number;
  evidence?: string;
}

/**
 * Heuristic: do the parenthesised contents look like a real function-call
 * argument list rather than English prose? Strong signals: addresses, hex
 * literals, identifiers separated by commas, struct literals, named args
 * (`paramName:`), or numeric base-units. Used to gate the generic
 * `swap(` matcher against false positives like "swap (state-changing)".
 */
function looksLikeCallArgs(argText: string): boolean {
  const inner = argText.replace(/^\(|\)$/g, "").trim();
  if (inner.length === 0) return true;
  if (/0x[a-fA-F0-9]{6,}/.test(inner)) return true;
  if (/[,;]/.test(inner)) return true;
  if (/\d{6,}/.test(inner)) return true;
  if (/[{}\[\]]/.test(inner)) return true;
  if (/[A-Za-z_$][\w$]*\s*:/.test(inner)) return true;
  if (/[A-Za-z_$][\w$]*\s*\(/.test(inner)) return true;
  return false;
}

/**
 * Find the matching closing parenthesis for an opening `(` whose index is
 * given. Returns the index of `)` or -1 if unbalanced.
 */
function findMatchingParen(content: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Locate `setInterval(...)` blocks and return their `[startBody, endBody]` slices. */
function getSetIntervalBodies(content: string): { start: number; end: number }[] {
  const bodies: { start: number; end: number }[] = [];
  SETINTERVAL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((m = SETINTERVAL_RE.exec(content)) !== null) {
    if (isInComment(content, m.index)) continue;
    const openIdx = content.indexOf("(", m.index);
    if (openIdx === -1) continue;
    const closeIdx = findMatchingParen(content, openIdx);
    if (closeIdx === -1) continue;
    bodies.push({ start: openIdx, end: closeIdx });
  }
  return bodies;
}

function checkQuoteThenSwap(file: SkillFile, findings: PreparedFinding[]): void {
  const content = file.content;
  const path = file.relativePath;
  QUOTE_RE.lastIndex = 0;
  let qMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((qMatch = QUOTE_RE.exec(content)) !== null) {
    if (isInComment(content, qMatch.index)) continue;
    if (isInProse(path, content, qMatch.index)) continue;
    const window = content.slice(qMatch.index, qMatch.index + 500);
    if (!SWAP_KEYWORDS_RE.test(window)) continue;
    findings.push({
      id: "W10-001",
      title: "Quote-then-swap atomic in same trust domain",
      description:
        "An on-chain spot price is read (getReserves / slot0 / getAmountsOut / quoteExactInputSingle) and immediately consumed by a swap call. An attacker can sandwich the agent's transaction or front-run the read so that the swap executes against a manipulated price.",
      severity: "high",
      remediation:
        "Source prices from a TWAP, Chainlink, Pyth, or RedStone feed and corroborate against an off-chain quote. Never derive `minAmountOut` from the same spot read used for the trade.",
      file: path,
      line: getLineNumber(content, qMatch.index),
      evidence: getEvidenceLine(content, qMatch.index),
    });
  }
}

/**
 * W10-002: swap call without a min-out parameter visible in the args.
 *
 * Specific router entrypoints (swapExactTokensForTokens, exactInputSingle,
 * etc.) are unambiguous and stay critical. The bare `swap(` token is too
 * permissive — it false-positives on prose like "execute a swap (state)" —
 * so generic matches are gated on (a) not being in markdown narrative and
 * (b) the args looking like a function-call argument list. When only the
 * generic form matches we emit a high finding rather than critical.
 */
function checkSwapMinOut(file: SkillFile, findings: PreparedFinding[]): void {
  const content = file.content;
  const path = file.relativePath;
  const reportSwap = (matchIdx: number, severity: "critical" | "high") => {
    if (isInComment(content, matchIdx)) return;
    if (isInProse(path, content, matchIdx)) return;
    const openIdx = content.indexOf("(", matchIdx);
    if (openIdx === -1) return;
    const closeIdx = findMatchingParen(content, openIdx);
    if (closeIdx === -1) return;
    const argText = content.slice(openIdx, closeIdx + 1);
    if (MIN_OUT_RE.test(argText)) return;
    if (severity === "high" && !looksLikeCallArgs(argText)) return;
    findings.push({
      id: "W10-002",
      title: "Swap call missing minimum-output guard",
      description:
        "A swap is executed without a `minAmountOut` / `amountOutMin` / `minOut` argument visible in the call. Without an explicit floor the trade will accept any output amount, exposing the agent to total loss against a manipulated pool.",
      severity,
      remediation:
        "Always pass an explicit minimum output derived from a manipulation-resistant price source (TWAP, Chainlink, Pyth) and rejected if the on-chain quote diverges by more than the configured slippage budget.",
      file: path,
      line: getLineNumber(content, matchIdx),
      evidence: getEvidenceLine(content, matchIdx),
    });
  };

  SWAP_SPECIFIC_RE.lastIndex = 0;
  let sMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((sMatch = SWAP_SPECIFIC_RE.exec(content)) !== null) {
    reportSwap(sMatch.index, "critical");
  }

  SWAP_GENERIC_RE.lastIndex = 0;
  let gMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((gMatch = SWAP_GENERIC_RE.exec(content)) !== null) {
    reportSwap(gMatch.index, "high");
  }
}

function scanCodeFile(file: SkillFile): PreparedFinding[] {
  const findings: PreparedFinding[] = [];
  const content = file.content;
  const path = file.relativePath;

  checkQuoteThenSwap(file, findings);
  checkSwapMinOut(file, findings);

  // W10-003 / W10-004: literal or model-supplied slippage values.
  SLIPPAGE_LITERAL_RE.lastIndex = 0;
  let lMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((lMatch = SLIPPAGE_LITERAL_RE.exec(content)) !== null) {
    if (isInComment(content, lMatch.index)) continue;
    if (isInProse(path, content, lMatch.index)) continue;
    const raw = lMatch[1] ?? lMatch[2];
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    if (value > 5) {
      findings.push({
        id: "W10-003",
        title: "Slippage tolerance exceeds 5%",
        description: `A static slippage value of ${raw} is configured, which is larger than the 5% safety threshold. Wide slippage tolerances let a manipulated pool drain a meaningful fraction of every trade.`,
        severity: "high",
        remediation:
          "Tighten the slippage budget to <= 5% (typically 0.5–1%) and source the budget from policy, not skill source. Reject trades whose expected price deviates from a manipulation-resistant feed.",
        file: path,
        line: getLineNumber(content, lMatch.index),
        evidence: getEvidenceLine(content, lMatch.index),
      });
    }
  }

  SLIPPAGE_VARIABLE_RE.lastIndex = 0;
  let vMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((vMatch = SLIPPAGE_VARIABLE_RE.exec(content)) !== null) {
    if (isInComment(content, vMatch.index)) continue;
    if (isInProse(path, content, vMatch.index)) continue;
    const expr = vMatch[1];
    if (
      !/\b(?:response|completion|message|model|answer|llm|output|reply|choices|tool|args)\b/i.test(
        expr,
      )
    ) {
      continue;
    }
    findings.push({
      id: "W10-004",
      title: "Slippage tolerance sourced from model output",
      description: `Slippage is derived from a model-supplied variable (\`${expr}\`). An attacker who can influence the model's output (through prompt injection or tool-result poisoning) can also widen the slippage budget at trade time.`,
      severity: "medium",
      remediation:
        "Treat slippage as a policy parameter. Read it from manifest config, validate it against a hard maximum, and never let the model directly populate it.",
      file: path,
      line: getLineNumber(content, vMatch.index),
      evidence: getEvidenceLine(content, vMatch.index),
    });
  }

  // W10-005: deadlines longer than 5 minutes.
  DEADLINE_RE.lastIndex = 0;
  let dMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((dMatch = DEADLINE_RE.exec(content)) !== null) {
    if (isInComment(content, dMatch.index)) continue;
    if (isInProse(path, content, dMatch.index)) continue;
    const offset = Number.parseInt(dMatch[1], 10);
    if (!Number.isFinite(offset) || offset <= 300) continue;
    findings.push({
      id: "W10-005",
      title: "Swap deadline exceeds 5 minutes",
      description: `A swap deadline is set to now + ${offset} seconds, which is wider than the recommended 5-minute window. Long deadlines let an attacker include a stale transaction after a favourable manipulation window opens.`,
      severity: "medium",
      remediation:
        "Use a deadline of at most 300 seconds (5 minutes) past the current block timestamp. For automated agents, prefer 60 seconds or one block.",
      file: path,
      line: getLineNumber(content, dMatch.index),
      evidence: getEvidenceLine(content, dMatch.index),
    });
  }

  // W10-006: swap inside a polling loop.
  const intervalBodies = getSetIntervalBodies(content);
  for (const body of intervalBodies) {
    let recorded = false;
    for (const re of [SWAP_SPECIFIC_RE, SWAP_GENERIC_RE]) {
      if (recorded) break;
      re.lastIndex = body.start;
      let inner: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
      while ((inner = re.exec(content)) !== null) {
        if (inner.index >= body.end) break;
        if (isInComment(content, inner.index)) continue;
        if (isInProse(path, content, inner.index)) continue;
        findings.push({
          id: "W10-006",
          title: "Swap executed inside polling loop",
          description:
            "A swap call appears inside a `setInterval` body. The agent's polling cadence is an exploitable side-channel: an attacker who learns the interval can pre-position liquidity and let the loop trade into the manipulated pool repeatedly.",
          severity: "medium",
          remediation:
            "Trigger trades on signed external intents (TWAP crossings, off-chain quotes, oracle updates) instead of a fixed polling interval. Add jitter and rate limits if polling cannot be removed.",
          file: path,
          line: getLineNumber(content, inner.index),
          evidence: getEvidenceLine(content, inner.index),
        });
        recorded = true;
        break;
      }
    }
  }

  return findings;
}

function scanManifest(skill: AgentSkill): PreparedFinding[] {
  const findings: PreparedFinding[] = [];
  const manifest = skill.manifest as unknown as Manifest;
  const actionsRaw = manifest.actions;
  const actions = Array.isArray(actionsRaw)
    ? actionsRaw.filter((a): a is string => typeof a === "string")
    : [];
  const oracle = manifest.web3?.oracle;
  const oracleSourceDeclared =
    typeof oracle?.source === "string" && oracle.source.trim().length > 0;
  const hasTradeAction = actions.some((a) => TRADE_ACTIONS.has(a.toLowerCase()));

  if (hasTradeAction && !oracleSourceDeclared) {
    findings.push({
      id: "W10-010",
      title: "Trade-like actions declared without oracle source",
      description:
        "The manifest declares one or more trading actions (swap/trade/buy/sell/liquidate/rebalance) but does not declare `web3.oracle.source`. Without a manifest-pinned price source the skill is free to use raw on-chain spot prices, which are manipulable.",
      severity: "high",
      remediation:
        "Declare `web3.oracle.source` (e.g. a Chainlink feed, Pyth product, or TWAP window) and `web3.oracle.type` so reviewers and runtime policy can validate the price path.",
    });
  }

  if (oracle?.type === "spot") {
    findings.push({
      id: "W10-011",
      title: "Manifest declares spot oracle",
      description:
        "The manifest's `web3.oracle.type` is set to `spot`. Spot prices read directly from a pool can be manipulated within a single block by a flash-loan attacker; declaring spot as the oracle source acknowledges and ships that risk.",
      severity: "high",
      remediation:
        "Switch `web3.oracle.type` to a manipulation-resistant source: `twap`, `chainlink`, `pyth`, or `redstone`. Cross-validate with at least one independent feed when the trade size warrants it.",
    });
  }

  return findings;
}

/**
 * Detect oracle manipulation and slippage hazards in a skill.
 */
export function checkOracleSlippage(skill: AgentSkill): SecurityFinding[] {
  const prepared: PreparedFinding[] = [];

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    prepared.push(...scanCodeFile(file));
  }

  prepared.push(...scanManifest(skill));

  const findings: SecurityFinding[] = [];
  const counters = new Map<string, number>();
  for (const p of prepared) {
    const next = (counters.get(p.id) ?? 0) + 1;
    counters.set(p.id, next);
    findings.push({
      id: `${p.id}-${next}`,
      rule: "web3-oracle-manipulation",
      severity: p.severity,
      category: "web3-oracle-manipulation",
      title: p.title,
      description: p.description,
      file: p.file,
      line: p.line,
      evidence: p.evidence,
      remediation: p.remediation,
    });
  }

  return findings;
}
