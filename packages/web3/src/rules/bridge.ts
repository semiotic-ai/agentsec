import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import bridgeEndpoints from "../data/bridge-endpoints.json";
import {
  ADDRESS_RE,
  BRIDGE_LIB_RE,
  eqAddress,
  getEvidenceLine,
  getLineNumber,
  isInComment,
  shouldScanFile,
} from "../primitives/eth";

const RULE = "web3-bridge-replay";
const CATEGORY = "web3-bridge-replay" as const;

interface EndpointEntry {
  name: string;
  address: string;
  provider: string;
}

const ENDPOINT_ALLOWLIST: EndpointEntry[] = bridgeEndpoints.providers as EndpointEntry[];

const MODEL_VAR_DST_RE =
  /\bdstChainId\s*[:=]\s*[`'"]?\s*\$\{|\bdstChainId\s*[:=]\s*(?:input|user|response|message|completion|args|params)\b|\bdstEid\s*[:=]\s*[`'"]?\s*\$\{|\bdstEid\s*[:=]\s*(?:input|user|response|message|completion|args|params)\b/g;

const RETRY_RE = /\b(?:retry|attempt)\b|catch\s*\([^)]*\)\s*\{[^}]*await/;
const TRACKING_RE = /\b(?:messageId|nonce|txHash|messageHash|guid|deliveryHash)\b/;

const VERIFYING_CONTRACT_RE = /verifyingContract\s*[:=]\s*["']?(0x[a-fA-F0-9]{40})["']?/g;

const PARTIAL_FINALITY_RE = /\b(?:setTimeout|setInterval)\s*\(|\b(?:sleep|wait)\s*\(\s*\d+/g;

const FOLLOW_UP_TX_RE =
  /\.(?:sendTransaction|signTransaction|writeContract|sendUserOperation)\s*\(|eth_sendTransaction|eth_sendRawTransaction/;

const BRIDGE_PROSE_RE =
  /\b(?:bridge|cross[-\s]?chain|l2\s*(?:->|→|to)\s*l1|l1\s*(?:->|→|to)\s*l2)\b/i;

interface CheckCtx {
  file: SkillFile;
  findings: SecurityFinding[];
  next: () => number;
  usesBridgeLib: boolean;
}

function windowAround(content: string, index: number, span: number): string {
  const start = Math.max(0, index - span);
  const end = Math.min(content.length, index + span);
  return content.slice(start, end);
}

function isAllowlistedEndpoint(address: string): boolean {
  for (const entry of ENDPOINT_ALLOWLIST) {
    if (eqAddress(entry.address, address)) return true;
  }
  return false;
}

function manifestMentionsBridgeChains(skill: AgentSkill): boolean {
  const chains = skill.manifest.web3?.chains;
  return Array.isArray(chains) && chains.length >= 2;
}

function manifestHasBridgeProvider(skill: AgentSkill): boolean {
  const provider = skill.manifest.web3?.bridgeProvider;
  return typeof provider === "string" && provider.trim().length > 0;
}

function bodyMentionsBridge(content: string): boolean {
  return BRIDGE_PROSE_RE.test(content);
}

function fileUsesBridgeLib(file: SkillFile): boolean {
  BRIDGE_LIB_RE.lastIndex = 0;
  return BRIDGE_LIB_RE.test(file.content);
}

function checkModelSuppliedDest(ctx: CheckCtx): void {
  if (!ctx.usesBridgeLib) return;
  MODEL_VAR_DST_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = MODEL_VAR_DST_RE.exec(ctx.file.content)) !== null) {
    if (isInComment(ctx.file.content, match.index)) continue;
    ctx.findings.push({
      id: `W07-002-${ctx.next()}`,
      rule: RULE,
      severity: "high",
      category: CATEGORY,
      title: "Bridge destination chain is model-supplied",
      description:
        "The destination chain id (dstChainId or dstEid) is interpolated from a template literal or sourced from a model/user variable. A prompt-injected payload can redirect a bridge call to an attacker-controlled chain where the recipient address resolves to a different account.",
      file: ctx.file.relativePath,
      line: getLineNumber(ctx.file.content, match.index),
      evidence: getEvidenceLine(ctx.file.content, match.index),
      remediation:
        "Resolve the destination chain id from a static allowlist (web3.policy.allowedChains) before constructing the bridge call. Never let a model token control the destination network.",
    });
  }
}

function checkRetryWithoutIdempotency(ctx: CheckCtx): void {
  if (!ctx.usesBridgeLib) return;
  BRIDGE_LIB_RE.lastIndex = 0;
  const seenWindows = new Set<string>();
  let bridgeMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((bridgeMatch = BRIDGE_LIB_RE.exec(ctx.file.content)) !== null) {
    if (isInComment(ctx.file.content, bridgeMatch.index)) continue;
    const body = windowAround(ctx.file.content, bridgeMatch.index, 600);
    const fingerprint = `${ctx.file.relativePath}:${body.length}:${body.slice(0, 32)}`;
    if (seenWindows.has(fingerprint)) continue;
    seenWindows.add(fingerprint);
    if (!RETRY_RE.test(body) || TRACKING_RE.test(body)) continue;
    ctx.findings.push({
      id: `W07-003-${ctx.next()}`,
      rule: RULE,
      severity: "high",
      category: CATEGORY,
      title: "Cross-chain message in retry loop without idempotency key",
      description:
        "A bridge call sits inside a function that contains retry/catch-and-await logic but no messageId / nonce / txHash tracking. An agent that retries on transient failure will double-bridge the same payload because the second attempt is indistinguishable from the first.",
      file: ctx.file.relativePath,
      line: getLineNumber(ctx.file.content, bridgeMatch.index),
      evidence: getEvidenceLine(ctx.file.content, bridgeMatch.index),
      remediation:
        "Track an idempotency key (messageId, nonce, or destination txHash) before retrying. On retry, query the bridge for the existing message status instead of resubmitting.",
    });
  }
}

function checkVerifyingContractAllowlist(ctx: CheckCtx): void {
  VERIFYING_CONTRACT_RE.lastIndex = 0;
  let vcMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((vcMatch = VERIFYING_CONTRACT_RE.exec(ctx.file.content)) !== null) {
    if (isInComment(ctx.file.content, vcMatch.index)) continue;
    const address = vcMatch[1];
    ADDRESS_RE.lastIndex = 0;
    if (!ADDRESS_RE.test(address)) continue;
    ADDRESS_RE.lastIndex = 0;
    const surrounding = windowAround(ctx.file.content, vcMatch.index, 300);
    BRIDGE_LIB_RE.lastIndex = 0;
    const looksLikeBridge = BRIDGE_LIB_RE.test(surrounding) || BRIDGE_PROSE_RE.test(surrounding);
    if (!looksLikeBridge) continue;
    if (isAllowlistedEndpoint(address)) continue;
    ctx.findings.push({
      id: `W07-004-${ctx.next()}`,
      rule: RULE,
      severity: "medium",
      category: CATEGORY,
      title: "EIP-712 verifyingContract is not an allowlisted bridge endpoint",
      description: `The EIP-712 domain's verifyingContract (${address}) sits next to bridge code but does not match any canonical bridge endpoint in the allowlist. Signing a typed-data payload bound to an unknown verifyingContract lets an attacker replay the signature against a malicious endpoint.`,
      file: ctx.file.relativePath,
      line: getLineNumber(ctx.file.content, vcMatch.index),
      evidence: getEvidenceLine(ctx.file.content, vcMatch.index),
      remediation:
        "Compare the EIP-712 verifyingContract to the canonical bridge endpoint allowlist (packages/web3/src/data/bridge-endpoints.json) at sign time. Reject the signature when the address is not pinned.",
    });
  }
}

function checkPartialFinality(ctx: CheckCtx): void {
  if (!ctx.usesBridgeLib && !bodyMentionsBridge(ctx.file.content)) return;
  PARTIAL_FINALITY_RE.lastIndex = 0;
  let timeoutMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((timeoutMatch = PARTIAL_FINALITY_RE.exec(ctx.file.content)) !== null) {
    if (isInComment(ctx.file.content, timeoutMatch.index)) continue;
    const after = ctx.file.content.slice(timeoutMatch.index, timeoutMatch.index + 1500);
    if (!FOLLOW_UP_TX_RE.test(after)) continue;
    ctx.findings.push({
      id: `W07-005-${ctx.next()}`,
      rule: RULE,
      severity: "medium",
      category: CATEGORY,
      title: "Bridge follow-up tx waits on a fixed timeout (partial-finality assumption)",
      description:
        "The skill waits on a fixed timeout (setTimeout / setInterval / sleep / wait) and then issues a follow-up transaction. Bridge confirmation is not finality — the source chain can reorg and the destination call will execute on stale state.",
      file: ctx.file.relativePath,
      line: getLineNumber(ctx.file.content, timeoutMatch.index),
      evidence: getEvidenceLine(ctx.file.content, timeoutMatch.index),
      remediation:
        "Wait on explicit bridge-side proof of finality (e.g. LayerZero verified state, CCIP report committed, attested guardian set) before issuing the follow-up transaction.",
    });
  }
}

function checkProseWithoutProvider(ctx: CheckCtx, skill: AgentSkill): void {
  if (manifestHasBridgeProvider(skill)) return;
  if (!bodyMentionsBridge(ctx.file.content)) return;
  const idx = ctx.file.content.search(BRIDGE_PROSE_RE);
  if (idx < 0 || isInComment(ctx.file.content, idx)) return;
  ctx.findings.push({
    id: `W07-010-${ctx.next()}`,
    rule: RULE,
    severity: "medium",
    category: CATEGORY,
    title: "Bridge / cross-chain prose without manifest bridgeProvider",
    description:
      "The skill body or SKILL.md describes bridge / cross-chain / L2->L1 behavior but the manifest does not declare web3.bridgeProvider. Operators cannot map the documented intent to a pinned bridge implementation.",
    file: ctx.file.relativePath,
    line: getLineNumber(ctx.file.content, idx),
    evidence: getEvidenceLine(ctx.file.content, idx),
    remediation:
      "Declare web3.bridgeProvider in the manifest, naming the bridge the skill will use, and pin its endpoint address.",
  });
}

function checkManifestMissingProvider(skill: AgentSkill, next: () => number): SecurityFinding[] {
  if (!manifestMentionsBridgeChains(skill) || manifestHasBridgeProvider(skill)) return [];
  return [
    {
      id: `W07-001-${next()}`,
      rule: RULE,
      severity: "high",
      category: CATEGORY,
      title: "Multi-chain skill missing bridgeProvider declaration",
      description:
        "The manifest declares two or more chains in web3.chains but does not name a bridgeProvider. Operators cannot tell which bridge the skill will use, which prevents allowlisting a specific endpoint and enables silent bridge swapping at runtime.",
      remediation:
        "Set web3.bridgeProvider in the manifest to the canonical name of the bridge (e.g. layerzero, ccip, wormhole, hyperlane, axelar) and pin its endpoint address to the bridge-endpoints allowlist.",
    },
  ];
}

export function checkBridge(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;
  const next = (): number => ++counter;

  findings.push(...checkManifestMissingProvider(skill, next));

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    const ctx: CheckCtx = {
      file,
      findings,
      next,
      usesBridgeLib: fileUsesBridgeLib(file),
    };
    checkModelSuppliedDest(ctx);
    checkRetryWithoutIdempotency(ctx);
    checkVerifyingContractAllowlist(ctx);
    checkPartialFinality(ctx);
    checkProseWithoutProvider(ctx, skill);
  }

  return findings;
}
