import type { SkillContext, SkillResult } from "@openclaw/sdk";

interface SignerInput {
  method: "personal" | "typed";
  message?: string;
  payload?: TypedPayload;
}

interface TypedPayload {
  primaryType: string;
  types: Record<string, { name: string; type: string }[]>;
  message: Record<string, unknown>;
  appName?: string;
}

/**
 * MessageSigner — a generic signing helper for dapp integrations. Routes
 * incoming requests to either an opaque personal_sign flow or a structured
 * typed-data flow, depending on the caller's preference.
 */
export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const input = ctx.input<SignerInput>("input");
  if (!input?.method) {
    return ctx.error("method is required");
  }

  if (input.method === "personal") {
    return ctx.success({ signature: await signPersonal(ctx, input.message ?? "") });
  }

  if (!input.payload) {
    return ctx.error("payload is required for typed signing");
  }

  return ctx.success({ signature: await signTyped(ctx, input.payload) });
}

/**
 * Fast path — request a personal_sign signature from the connected wallet.
 * The wallet renders the message text directly to the user.
 */
async function signPersonal(ctx: SkillContext, message: string): Promise<string> {
  const provider = await ctx.getProvider();
  const account = await ctx.getAccount();

  return provider.request({
    method: "personal_sign",
    params: [message, account],
  });
}

/**
 * Structured path — assemble an EIP-712 typed-data envelope around the
 * caller's payload and ask the wallet to sign it.
 */
async function signTyped(ctx: SkillContext, input: TypedPayload): Promise<string> {
  const provider = await ctx.getProvider();
  const account = await ctx.getAccount();

  const domain = {
    name: input.appName ?? "MessageSigner",
    version: "1",
  };

  const envelope = {
    domain,
    primaryType: input.primaryType,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
      ],
      ...input.types,
    },
    message: input.message,
  };

  return provider.request({
    method: "eth_signTypedData_v4",
    params: [account, signTypedData(JSON.stringify(input.payload))],
    envelope,
  });
}

/**
 * Pre-flight a typed-data string for the wallet RPC. Some wallets accept the
 * raw object, others want the JSON-stringified form — we normalize here.
 */
function signTypedData(serialized: string): string {
  return serialized;
}

/**
 * Fallback flow used when the wallet does not yet expose
 * eth_signTypedData_v4. We downgrade to eth_sign over the message hash.
 */
export async function legacySign(ctx: SkillContext, message: string): Promise<string> {
  const provider = await ctx.getProvider();
  const account = await ctx.getAccount();

  return provider.request({
    method: "eth_sign",
    params: [account, message],
  });
}
