/**
 * @agentsec/web3 — AST-10 Web3 Annex rule pack.
 *
 * Implements AST-W01..AST-W12 covering Web3-specific risks unique to
 * AI agent skills that hold keys, sign typed data, call contracts,
 * bridge assets, or expose chain capabilities through MCP.
 *
 * Wire into `@agentsec/scanner` via `Scanner.constructor({ extraRules: WEB3_RULES })`
 * or via the CLI flag `--profile web3`.
 *
 * See:
 * - docs/plans/ast10-web3-annex-strategy.md
 * - docs/plans/ast10-web3-annex-rules.md
 */

import type { AgentSkill, SecurityFinding } from "@agentsec/shared";

import { checkAuditSink } from "./rules/audit-sink";
import { checkBridge } from "./rules/bridge";
import { checkContractTargets } from "./rules/contract-targets";
import { checkEip7702 } from "./rules/eip7702";
import { checkKeyMaterial } from "./rules/key-material";
import { checkMcpChainTools } from "./rules/mcp-chain-tools";
import { checkOracleSlippage } from "./rules/oracle-slippage";
import { checkPermit2 } from "./rules/permit2";
import { checkRpc } from "./rules/rpc";
import { checkSessionKeys } from "./rules/session-keys";
import { checkSigningAuthority } from "./rules/signing-authority";
import { checkTypedData } from "./rules/typed-data";

export { detectWeb3, type Web3Detection } from "./detect";

export {
  checkAuditSink,
  checkBridge,
  checkContractTargets,
  checkEip7702,
  checkKeyMaterial,
  checkMcpChainTools,
  checkOracleSlippage,
  checkPermit2,
  checkRpc,
  checkSessionKeys,
  checkSigningAuthority,
  checkTypedData,
};

/**
 * Mirrors `RuleDefinition` from `@agentsec/scanner`. Inlined here to avoid
 * a cyclic workspace dependency — scanner is consumer-of-rules, not a
 * dependency of rule packs.
 */
export interface Web3RuleDefinition {
  name: string;
  category: string;
  description: string;
  owaspId: string;
  owaspLink: string;
  run: (skill: AgentSkill) => SecurityFinding[];
}

const ANNEX_LINK =
  "https://github.com/semiotic-ai/agentsec/blob/main/docs/plans/ast10-web3-annex-rules.md";

/** All AST-10 Web3 Annex rules. Ordered AST-W01..AST-W12. */
export const WEB3_RULES: Web3RuleDefinition[] = [
  {
    name: "web3-signing-authority",
    category: "web3-signing-authority",
    description:
      "Detects unbounded signing authority — hot signers without value caps, contract allowlists, chain restrictions, or daily limits (AST-W01)",
    owaspId: "AST-W01",
    owaspLink: ANNEX_LINK,
    run: checkSigningAuthority,
  },
  {
    name: "web3-permit-capture",
    category: "web3-permit-capture",
    description:
      "Detects EIP-2612 / Permit2 signature-capture phishing patterns: unbounded allowance, model-supplied spender, far-future deadlines (AST-W02)",
    owaspId: "AST-W02",
    owaspLink: ANNEX_LINK,
    run: checkPermit2,
  },
  {
    name: "web3-eip7702-delegation",
    category: "web3-eip7702-delegation",
    description:
      "Detects EIP-7702 delegation hijack patterns: SetCodeAuthorization to non-allowlisted delegates, chainId=0, missing revoke flow (AST-W03)",
    owaspId: "AST-W03",
    owaspLink: ANNEX_LINK,
    run: checkEip7702,
  },
  {
    name: "web3-blind-signing",
    category: "web3-blind-signing",
    description:
      "Detects blind / opaque signing: personal_sign downgrades, JSON.stringify of model output as typed-data, missing chainId / verifyingContract (AST-W04)",
    owaspId: "AST-W04",
    owaspLink: ANNEX_LINK,
    run: checkTypedData,
  },
  {
    name: "web3-rpc-substitution",
    category: "web3-rpc-substitution",
    description:
      "Detects RPC endpoint substitution and mempool leakage: hardcoded URLs with embedded keys, public-mempool broadcast, missing chainId verification (AST-W05)",
    owaspId: "AST-W05",
    owaspLink: ANNEX_LINK,
    run: checkRpc,
  },
  {
    name: "web3-contract-targets",
    category: "web3-contract-targets",
    description:
      "Detects unverified contract call targets and address-poisoning attack surface: model-derived `to`, checksum-naive compare, named-protocol calls without pin (AST-W06)",
    owaspId: "AST-W06",
    owaspLink: ANNEX_LINK,
    run: checkContractTargets,
  },
  {
    name: "web3-bridge-replay",
    category: "web3-bridge-replay",
    description:
      "Detects cross-chain / bridge action replay risk: missing bridgeProvider declaration, model-supplied dstChainId, no idempotency tracking (AST-W07)",
    owaspId: "AST-W07",
    owaspLink: ANNEX_LINK,
    run: checkBridge,
  },
  {
    name: "web3-mcp-chain-drift",
    category: "web3-mcp-chain-drift",
    description:
      "Detects MCP chain-tool drift / capability smuggling: unpinned MCP servers, undeclared chain capabilities, off-allowlist hosts (AST-W08)",
    owaspId: "AST-W08",
    owaspLink: ANNEX_LINK,
    run: checkMcpChainTools,
  },
  {
    name: "web3-session-key-erosion",
    category: "web3-session-key-erosion",
    description:
      "Detects ERC-7715 / ERC-7710 session-key erosion: missing expiry / valueLimit / targets / selectors / chainIds, unbounded `requestPermissions` (AST-W09)",
    owaspId: "AST-W09",
    owaspLink: ANNEX_LINK,
    run: checkSessionKeys,
  },
  {
    name: "web3-oracle-manipulation",
    category: "web3-oracle-manipulation",
    description:
      "Detects slippage / oracle manipulation by agent loop: spot-priced quote-then-swap, missing minAmountOut, model-supplied slippage, polling-cadence swaps (AST-W10)",
    owaspId: "AST-W10",
    owaspLink: ANNEX_LINK,
    run: checkOracleSlippage,
  },
  {
    name: "web3-key-material-leak",
    category: "web3-key-material-leak",
    description:
      "Detects key material in agent memory / logs: 64-hex private keys, BIP-39 mnemonics, env-key reads flowing to logs or tool arguments (AST-W11)",
    owaspId: "AST-W11",
    owaspLink: ANNEX_LINK,
    run: checkKeyMaterial,
  },
  {
    name: "web3-no-audit-killswitch",
    category: "web3-no-audit-killswitch",
    description:
      "Detects missing on-chain action audit / kill-switch: no audit.sink, no killSwitch.contract, signing without policy versioning (AST-W12)",
    owaspId: "AST-W12",
    owaspLink: ANNEX_LINK,
    run: checkAuditSink,
  },
];
