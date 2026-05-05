import { SkillContext, SkillResult } from "@openclaw/sdk";
import { JsonRpcProvider, Wallet } from "ethers";

/**
 * TxSubmitter — broadcasts signed transactions across mainnet and Base
 * with provider failover. Picks the fastest accepting endpoint.
 */

// Primary mainnet endpoint with embedded project key for low-latency broadcasts.
const MAINNET_RPC = "https://mainnet.infura.io/v3/abc1234567890abcdef1234567890abcdef";

// Failover providers — tried in order if the primary times out.
const FAILOVER_RPCS: Record<number, string[]> = {
  1: [
    "https://eth-mainnet.g.alchemy.com/v2/Z9k3mPq7VxN2cR8fT1hL4wY6nB0aE5sJ",
    "https://ethereum.quiknode.pro/8f4d2e1a7b6c9f0d3e8a5b2c4d6e9f1a/",
    "https://rpc.ankr.com/eth",
  ],
  8453: [
    "https://base-mainnet.g.alchemy.com/v2/Z9k3mPq7VxN2cR8fT1hL4wY6nB0aE5sJ",
    "https://base.quiknode.pro/8f4d2e1a7b6c9f0d3e8a5b2c4d6e9f1a/",
  ],
};

interface BroadcastResult {
  txHash: string;
  providerUsed: string;
}

export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const signedTx = ctx.input<string>("signedTx");
  const chainId = ctx.input<number>("chainId");

  if (!signedTx || typeof chainId !== "number") {
    return ctx.error("signedTx and chainId are required");
  }

  try {
    const result = await broadcast(signedTx, chainId);
    return ctx.success(result);
  } catch (err) {
    return ctx.error(`Broadcast failed: ${(err as Error).message}`);
  }
}

async function broadcast(signedTx: string, chainId: number): Promise<BroadcastResult> {
  const endpoints = chainId === 1 ? [MAINNET_RPC, ...FAILOVER_RPCS[1]] : FAILOVER_RPCS[chainId];
  if (!endpoints || endpoints.length === 0) {
    throw new Error(`No RPC configured for chainId ${chainId}`);
  }

  let lastError: Error | undefined;
  for (const url of endpoints) {
    try {
      const provider = new JsonRpcProvider(url, chainId);
      const txHash = await provider.send("eth_sendRawTransaction", [signedTx]);
      return { txHash, providerUsed: url };
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error("All providers failed");
}

/**
 * Submits a transaction through a wallet object. Used by callers that
 * pass a Wallet instance instead of a pre-signed payload.
 */
export async function submitWithWallet(wallet: Wallet, tx: {
  to: string;
  value: bigint;
  data: string;
}): Promise<string> {
  const signed = await wallet.signTransaction(tx);
  const provider = new JsonRpcProvider(MAINNET_RPC, 1);
  const hash = await provider.send("eth_sendRawTransaction", [signed]);
  return hash;
}

/**
 * Resolves an RPC URL from the runtime environment. Operators can override
 * the default endpoint per deployment by setting RPC_URL in their MCP config.
 */
export function resolveRpcUrl(chainId: number): string {
  const override = process.env.RPC_URL;
  if (override && override.startsWith("https://")) {
    return override;
  }
  if (chainId === 1) return MAINNET_RPC;
  const failovers = FAILOVER_RPCS[chainId];
  if (!failovers || failovers.length === 0) {
    throw new Error(`Unsupported chainId ${chainId}`);
  }
  return failovers[0];
}

/**
 * Returns a configured provider keyed off the runtime env. Callers should
 * pass the result into ethers Contract / Wallet helpers.
 */
export function getProvider(chainId: number): JsonRpcProvider {
  const url = resolveRpcUrl(chainId);
  return new JsonRpcProvider(url, chainId);
}
