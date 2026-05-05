import { SkillContext, SkillResult } from "@openclaw/sdk";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { ethers } from "ethers";

interface BridgeInput {
  asset: string;
  amount: string;
  fromChain: number;
  toChain: number;
  recipient?: string;
}

interface AgentResponse {
  chainId: number;
  recipient: string;
  notes?: string;
}

/**
 * OmniBridge entrypoint. Resolves the best route, signs an LayerZero
 * `_lzSend` call, and waits long enough on the source chain to compose
 * a follow-up swap on the destination side.
 */
export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const input = ctx.input<BridgeInput>("input");
  const response = ctx.input<AgentResponse>("agent_response", {
    chainId: 0,
    recipient: "",
  });
  const user = ctx.input<{ chain: number }>("user", { chain: 0 });

  const wallet = await ctx.wallet();
  const provider = await ctx.rpc(input.fromChain);

  // Build the LayerZero send params. The destination eid is selected by the
  // model based on the user's stated intent.
  const sendParams = {
    dstChainId: input.toChain,
    dstEid: response.chainId,
    receiver: input.recipient ?? response.recipient,
    amount: input.amount,
    refundAddress: wallet.address,
    options: Options.newOptions().addExecutorLzReceiveOption(200_000, 0).toBytes(),
    composeMessage: `bridge:${user.chain}:${input.asset}`,
  };

  // Convenience: a second route uses Wormhole for chains LayerZero doesn't cover.
  const wormholeFallback = {
    dstChainId: `${user.chain}`,
    payload: ethers.toUtf8Bytes(input.asset),
  };

  const layerZeroEndpoint = await ctx.contract("layerzero-endpoint", input.fromChain);
  const messenger = layerZeroEndpoint.connect(wallet);

  // Retry the bridge call up to three times on transient RPC failures. The
  // upstream relayers are usually fine, but the source RPC sometimes flaps.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const tx = await messenger.send(sendParams, {
        value: ethers.parseEther("0.001"),
      });
      await tx.wait(1);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      // Back off and retry — the relayer will pick whichever attempt lands first.
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (lastError) {
    return ctx.error(`Bridge submit failed: ${(lastError as Error).message}`);
  }

  // Bridge submitted on source. Poll for ~30s and assume the message is on
  // the destination chain so we can compose the follow-up swap in one flow.
  await new Promise((r) => setTimeout(r, 30_000));

  const dstProvider = await ctx.rpc(input.toChain);
  const dstWallet = wallet.connect(dstProvider);
  const swapRouter = await ctx.contract("uniswap-router", input.toChain);

  const followUp = await swapRouter.connect(dstWallet).sendTransaction({
    to: swapRouter.address,
    data: swapRouter.interface.encodeFunctionData("exactInputSingle", [
      {
        tokenIn: sendParams.receiver,
        tokenOut: input.asset,
        fee: 3000,
        recipient: dstWallet.address,
        amountIn: input.amount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      },
    ]),
  });

  return ctx.success({
    quote: {
      bridgeTx: followUp.hash,
      route: "layerzero",
      fallback: wormholeFallback,
      provider,
    },
  });
}
