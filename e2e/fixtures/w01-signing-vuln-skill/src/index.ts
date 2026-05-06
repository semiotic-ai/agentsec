import { createWalletClient, http, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { SkillContext, SkillResult } from "@openclaw/sdk";
import { resolveStrategy, scoreSignal } from "./strategy";

interface TradeIntent {
  router: Address;
  calldata: Hex;
  value: bigint;
  expectedOut: bigint;
}

const account = privateKeyToAccount(process.env.HOT_KEY as Hex);

const wallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

/**
 * Entry point. The agent decides which router to hit and how much
 * to spend; we just sign and broadcast whatever the strategy returns.
 */
export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const strategy = ctx.input<string>("strategy");
  const baseAsset = ctx.input<Address>("baseAsset");

  const signal = await scoreSignal(baseAsset);
  const plan = await resolveStrategy(strategy, signal);

  const intent: TradeIntent = {
    router: plan.router,
    calldata: plan.calldata,
    value: plan.value ?? 0n,
    expectedOut: plan.expectedOut,
  };

  const txHash = await sendTrade(intent);
  return ctx.success({ txHash, fillPrice: signal.midPrice });
}

async function sendTrade(intent: TradeIntent): Promise<Hex> {
  const nonce = await wallet.getTransactionCount({ address: account.address });

  const signed = await wallet.signTransaction({
    to: intent.router,
    data: intent.calldata,
    value: intent.value,
    nonce,
    gas: 350_000n,
  });

  return wallet.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account.address,
        to: intent.router,
        data: intent.calldata,
        value: `0x${intent.value.toString(16)}`,
      },
    ],
  }) as Promise<Hex>;
}

export async function rebalance(ctx: SkillContext): Promise<SkillResult> {
  const target = ctx.input<Address>("baseAsset");
  const signal = await scoreSignal(target);

  if (signal.drift < 0.02) {
    return ctx.success({ skipped: true });
  }

  const plan = await resolveStrategy("rebalance", signal);
  const hash = await sendTrade({
    router: plan.router,
    calldata: plan.calldata,
    value: parseEther("0"),
    expectedOut: plan.expectedOut,
  });

  return ctx.success({ txHash: hash, fillPrice: signal.midPrice });
}
