import { JsonRpcProvider, Wallet } from "ethers";
import type { SkillContext, SkillResult } from "@openclaw/sdk";

interface StrategyParams {
  to?: string;
  value?: string;
  data?: string;
  chainId?: number;
}

/**
 * AutonomousAgent — picks a strategy, builds a transaction, signs, and
 * broadcasts. Runs unattended.
 */
export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const strategy = ctx.input<string>("strategy");
  const params = ctx.input<StrategyParams>("params", {});

  if (!strategy) return ctx.error("strategy is required");

  const decision = chooseAction(strategy, params);
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallet = new Wallet(process.env.HOT_KEY ?? "", provider);

  const tx = {
    to: decision.to,
    value: decision.value ?? "0",
    data: decision.data ?? "0x",
    chainId: decision.chainId ?? 1,
    nonce: await provider.getTransactionCount(wallet.address),
    gasLimit: 250_000n,
  };

  // W12-010: signing call site with no audit/journal/emit/log/record/trail token
  // W12-011: signing function with no policyVersion/auditId/requestId/correlationId token
  const signed = await signTransaction(wallet, tx);
  const sent = await provider.broadcastTransaction(signed);

  return ctx.success({ txHash: sent.hash, decision });
}

/**
 * Build the next on-chain action for the requested strategy.
 */
function chooseAction(strategy: string, params: StrategyParams) {
  switch (strategy) {
    case "rebalance":
      return {
        to: params.to ?? "0x0000000000000000000000000000000000000000",
        value: params.value ?? "0",
        data: params.data ?? "0x",
        chainId: params.chainId ?? 1,
      };
    case "yield":
      return {
        to: params.to ?? "0x0000000000000000000000000000000000000000",
        value: "0",
        data: params.data ?? "0x",
        chainId: params.chainId ?? 8453,
      };
    default:
      return {
        to: params.to ?? "0x0000000000000000000000000000000000000000",
        value: params.value ?? "0",
        data: params.data ?? "0x",
        chainId: params.chainId ?? 1,
      };
  }
}

/**
 * Sign a prepared transaction envelope with the hot wallet.
 */
async function signTransaction(wallet: Wallet, tx: Record<string, unknown>): Promise<string> {
  const populated = await wallet.populateTransaction(tx);
  return wallet.signTransaction(populated);
}

/**
 * Submit a raw RLP envelope via the configured RPC. Used by the
 * batch executor when it has already signed offline.
 */
export async function sendTx(rawTx: string): Promise<string> {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const sent = await provider.broadcastTransaction(rawTx);
  return sent.hash;
}
