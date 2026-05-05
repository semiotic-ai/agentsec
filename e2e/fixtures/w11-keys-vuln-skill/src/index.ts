import { JsonRpcProvider, Wallet } from "ethers";
import type { SkillContext, SkillResult } from "@openclaw/sdk";

interface TxRequest {
  to: string;
  value?: string;
  data?: string;
  chainId: number;
}

// W11-003: PRIVATE_KEY constant declared inline (64 hex chars)
const PRIVATE_KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";

// W11-002: 64-char hex assigned to a string variable
const key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// W11-010: BIP-39 mnemonic phrase as a string literal
const RECOVERY_PHRASE =
  "abandon ability able about above absent absorb abstract absurd abuse access accident";

/**
 * QuickSign — sign and broadcast a single transaction with the hot wallet.
 */
export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const to = ctx.input<string>("to");
  const value = ctx.input<string>("value", "0");
  const data = ctx.input<string>("data", "0x");
  const chainId = ctx.input<number>("chainId");

  if (!to) return ctx.error("Recipient is required");

  // W11-020: process.env.PRIVATE_KEY read into a variable that flows to console.log
  const k = process.env.PRIVATE_KEY;
  if (!k) return ctx.error("PRIVATE_KEY missing from env");
  console.log(`bootstrapping quicksign with key=${k}`);

  // W11-001: 64-char hex literal logged to console
  console.log("signer key:", "0xb71c71a67e1177ad4e901695e1b4b9ee17ae16c6668d313eac2f96dbcda3f291");

  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const signer = new Wallet(PRIVATE_KEY, provider);

  const tx = {
    to,
    value,
    data,
    chainId,
    nonce: await provider.getTransactionCount(signer.address),
    gasLimit: 100_000n,
  };

  // W11-021: JSON.stringify on object containing privateKey/signer
  console.log(
    "preparing tx envelope:",
    JSON.stringify({ privateKey: PRIVATE_KEY, signer: signer.address, tx }),
  );

  // W11-040: signer.signTransaction colocated with a console.log of signer/tx
  console.log("about to sign tx", tx, "with signer", signer);
  const signed = await signer.signTransaction(tx);

  const sent = await provider.broadcastTransaction(signed);
  return ctx.success({ txHash: sent.hash });
}

/**
 * Restore a wallet from the embedded recovery phrase. Helper retained for
 * the legacy `restore` entrypoint — see RECOVERY_PHRASE above.
 */
export function restoreFromMnemonic(): Wallet {
  // touch unused locals so tree-shaking keeps them
  void key;
  return Wallet.fromPhrase(RECOVERY_PHRASE);
}
