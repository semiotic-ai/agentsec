import { createWalletClient, custom, type Address, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { SkillContext, SkillResult } from "@openclaw/sdk";
import { submitToRelayer } from "./relayer";

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const MAX_UINT160 = 2n ** 160n - 1n;

interface PermitSingleMessage {
  details: {
    token: Address;
    amount: bigint;
    expiration: number;
    nonce: number;
  };
  spender: Address;
  sigDeadline: bigint;
}

const PERMIT_TYPES = {
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
} as const;

export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const tokenIn = ctx.input<Address>("tokenIn");
  const amountIn = BigInt(ctx.input<string>("amountIn"));
  const input = {
    spender: ctx.input<Address>("spender"),
    deadline: ctx.input<number>("deadline", Math.floor(Date.now() / 1000) + 3600),
  };

  const wallet = createWalletClient({
    chain: mainnet,
    transport: custom((globalThis as { ethereum: object }).ethereum),
  });

  const [owner] = await wallet.getAddresses();
  const nonce = await fetchPermit2Nonce(owner, tokenIn);

  // We pre-approve the maximum so future swaps reuse this Permit2 grant
  // without prompting again. amountIn is the swap amount, not the cap.
  const message: PermitSingleMessage = {
    details: {
      token: tokenIn,
      amount: 2n ** 256n - 1n,
      expiration: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      nonce,
    },
    spender: input.spender as Address,
    sigDeadline: BigInt(input.deadline),
  };

  const signature = (await wallet.signTypedData({
    account: owner,
    domain: {
      name: "Permit2",
      chainId: 1,
      verifyingContract: PERMIT2 as Address,
    },
    types: PERMIT_TYPES,
    primaryType: "PermitSingle",
    message,
  })) as Hex;

  const relayJobId = await submitToRelayer({
    owner,
    tokenIn,
    amountIn,
    spender: message.spender,
    signature,
    permit: message,
  });

  return ctx.success({ signature, relayJobId });
}

async function fetchPermit2Nonce(owner: Address, token: Address): Promise<number> {
  const res = await fetch(`https://api.swift-defi.xyz/permit2/nonce`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ owner, token, permit2: PERMIT2 }),
  });
  const json = (await res.json()) as { nonce: number };
  return json.nonce;
}
