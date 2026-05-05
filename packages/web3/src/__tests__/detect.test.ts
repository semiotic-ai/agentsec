import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { detectWeb3 } from "../detect";

function mockSkill(opts: {
  manifest?: Partial<SkillManifest>;
  files?: { name: string; content: string }[];
}): AgentSkill {
  return {
    id: "test",
    name: "test",
    version: "1.0.0",
    path: "/tmp/test",
    platform: "openclaw",
    manifest: {
      name: "test",
      version: "1.0.0",
      ...opts.manifest,
    },
    files: (opts.files ?? []).map((f) => ({
      path: `/tmp/test/${f.name}`,
      relativePath: f.name,
      content: f.content,
      language: "typescript",
      size: f.content.length,
    })),
  };
}

describe("detectWeb3: definite signals (manifest.web3 block)", () => {
  test("manifest with empty web3 block detects as definite", () => {
    const skill = mockSkill({ manifest: { web3: {} } });
    const det = detectWeb3(skill);
    expect(det.isWeb3).toBe(true);
    expect(det.confidence).toBe("definite");
    expect(det.signals.some((s) => s.includes("web3"))).toBe(true);
  });

  test("manifest.web3 with chains short-circuits other signals", () => {
    const skill = mockSkill({
      manifest: { web3: { chains: [1] } },
      files: [{ name: "index.ts", content: "console.log('plain text');" }],
    });
    const det = detectWeb3(skill);
    expect(det.confidence).toBe("definite");
    expect(det.signals.length).toBe(1);
  });
});

describe("detectWeb3: likely signals (library imports)", () => {
  test("imports viem", () => {
    const skill = mockSkill({
      files: [{ name: "index.ts", content: 'import { createPublicClient } from "viem";' }],
    });
    const det = detectWeb3(skill);
    expect(det.isWeb3).toBe(true);
    expect(det.confidence).toBe("likely");
    expect(det.signals.some((s) => s.includes("Web3 client library"))).toBe(true);
  });

  test("imports ethers", () => {
    const skill = mockSkill({
      files: [{ name: "index.ts", content: 'import { Wallet } from "ethers";' }],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("imports @solana/web3.js", () => {
    const skill = mockSkill({
      files: [{ name: "sol.ts", content: 'import { Connection } from "@solana/web3.js";' }],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("imports wagmi via require", () => {
    const skill = mockSkill({
      files: [{ name: "h.js", content: 'const { useAccount } = require("wagmi");' }],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });
});

describe("detectWeb3: likely signals (RPC method references)", () => {
  test("references eth_sendTransaction", () => {
    const skill = mockSkill({
      files: [
        { name: "x.ts", content: 'await provider.request({ method: "eth_sendTransaction" });' },
      ],
    });
    const det = detectWeb3(skill);
    expect(det.isWeb3).toBe(true);
    expect(det.signals.some((s) => s.includes("RPC method"))).toBe(true);
  });

  test("references signTypedData_v4", () => {
    const skill = mockSkill({
      files: [
        { name: "x.ts", content: 'provider.request({ method: "eth_signTypedData_v4", params });' },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("references wallet_requestPermissions", () => {
    const skill = mockSkill({
      files: [
        {
          name: "x.ts",
          content: 'await ethereum.request({ method: "wallet_requestPermissions" });',
        },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("references personal_sign", () => {
    const skill = mockSkill({
      files: [
        { name: "x.ts", content: 'await window.ethereum.request({ method: "personal_sign" });' },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });
});

describe("detectWeb3: likely signals (.sol files)", () => {
  test(".sol file in skill triggers detection", () => {
    const skill = mockSkill({
      files: [
        { name: "contract.sol", content: "pragma solidity ^0.8.0; contract X {}" },
        { name: "deploy.ts", content: "console.log('hi');" },
      ],
    });
    const det = detectWeb3(skill);
    expect(det.isWeb3).toBe(true);
    expect(det.signals.some((s) => s.includes("Solidity"))).toBe(true);
  });
});

describe("detectWeb3: multiple signals accumulate", () => {
  test("library + RPC method both reported", () => {
    const skill = mockSkill({
      files: [
        {
          name: "index.ts",
          content:
            'import { http } from "viem"; await provider.request({ method: "eth_sendTransaction" });',
        },
      ],
    });
    const det = detectWeb3(skill);
    expect(det.confidence).toBe("likely");
    expect(det.signals.length).toBe(2);
  });
});

describe("detectWeb3: weak signals (language only)", () => {
  test("description mentions blockchain → weak, isWeb3=false", () => {
    const skill = mockSkill({
      manifest: { description: "An assistant for blockchain newcomers — explains DeFi terms." },
    });
    const det = detectWeb3(skill);
    expect(det.confidence).toBe("weak");
    expect(det.isWeb3).toBe(false);
    expect(det.signals.some((s) => s.includes("language"))).toBe(true);
  });

  test("SKILL.md mentions wallet → weak", () => {
    const skill = mockSkill({
      files: [{ name: "SKILL.md", content: "# Helper\n\nA wallet of common shell snippets." }],
    });
    const det = detectWeb3(skill);
    expect(det.confidence).toBe("weak");
    expect(det.isWeb3).toBe(false);
  });
});

describe("detectWeb3: no signals", () => {
  test("plain skill with no Web3 references", () => {
    const skill = mockSkill({
      manifest: { description: "A markdown formatter." },
      files: [{ name: "index.ts", content: "export function fmt(s: string) { return s.trim(); }" }],
    });
    const det = detectWeb3(skill);
    expect(det.confidence).toBe("no");
    expect(det.isWeb3).toBe(false);
    expect(det.signals.length).toBe(0);
  });

  test("comment with 'wallet' word in unrelated context does not trigger", () => {
    const skill = mockSkill({
      files: [
        { name: "index.ts", content: "// adapt the user's wallet of preferences" },
        { name: "code.ts", content: "export function run() {}" },
      ],
    });
    const det = detectWeb3(skill);
    // language regex hits but only as weak — isWeb3 stays false
    expect(det.isWeb3).toBe(false);
  });
});

describe("detectWeb3: file-type filtering", () => {
  test("RPC reference inside .png file is ignored", () => {
    const skill = mockSkill({
      files: [{ name: "image.png", content: "eth_sendTransaction" }],
    });
    expect(detectWeb3(skill).confidence).toBe("no");
  });
});

describe("detectWeb3: protocol / standard references (SKILL.md-style skills)", () => {
  test("SKILL.md mentioning ERC-8004 detects as likely", () => {
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          content:
            "# erc-8004\n\nThis skill helps interpret the ERC-8004 trustless agent registry.",
        },
      ],
    });
    const det = detectWeb3(skill);
    expect(det.isWeb3).toBe(true);
    expect(det.confidence).toBe("likely");
    expect(det.signals.some((s) => s.includes("protocol or standard"))).toBe(true);
  });

  test("SKILL.md mentioning EIP-7702 detects", () => {
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          content: "Authorize an EIP-7702 delegation to a smart account.",
        },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("SKILL.md mentioning ERC-20 (no hyphen variant) detects", () => {
    const skill = mockSkill({
      files: [{ name: "SKILL.md", content: "Helps move ERC20 tokens between accounts." }],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("SKILL.md mentioning x402 detects", () => {
    const skill = mockSkill({
      files: [{ name: "SKILL.md", content: "Pay per request via the x402 payment protocol." }],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("SKILL.md mentioning Agent Commerce Protocol detects", () => {
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          content: "Coordinates trades through the Agent Commerce Protocol escrow contracts.",
        },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("SKILL.md mentioning Permit2 / Uniswap detects", () => {
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          content: "Builds a Permit2 signature for the Uniswap UniversalRouter.",
        },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("SKILL.md mentioning gwei / Solidity detects", () => {
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          content: "A Solidity helper that estimates gas in gwei before broadcasting.",
        },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("SKILL.md mentioning virtuals.io detects", () => {
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          content: "Tokenize an agent on virtuals.io and gate trades through ACP.",
        },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(true);
  });

  test("'erc' prefix without a number is not enough alone", () => {
    const skill = mockSkill({
      files: [{ name: "SKILL.md", content: "An ERC clerk who files paperwork." }],
    });
    // No digits → STRONG_PROTOCOL_RE does not match ERC alone
    expect(detectWeb3(skill).isWeb3).toBe(false);
  });
});

describe("detectWeb3: Ethereum address references", () => {
  test("SKILL.md mentioning a contract address detects", () => {
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          content:
            "The deckard.network token lives at 0x6ec2FD5636c71b624b3f3B03248aa7F9FD5e98de on Base.",
        },
      ],
    });
    const det = detectWeb3(skill);
    expect(det.isWeb3).toBe(true);
    // Both protocol AND address signals fire
    expect(det.signals.some((s) => s.includes("Ethereum address"))).toBe(true);
  });

  test("address-only with no other signals reports as weak (does NOT apply annex)", () => {
    // Tightened semantics: a single Ethereum address mentioned in prose is
    // not enough on its own to apply the 12-rule annex — too many
    // documentation-style skills mention an address without actually
    // touching chain. Users can still opt-in via `--profile web3`.
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          content: "Contact: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 for swaps.",
        },
      ],
    });
    const det = detectWeb3(skill);
    expect(det.isWeb3).toBe(false);
    expect(det.confidence).toBe("weak");
    expect(det.signals.some((s) => s.includes("Ethereum address"))).toBe(true);
  });

  test("0x prefix without 40 hex chars is ignored", () => {
    const skill = mockSkill({
      files: [{ name: "code.ts", content: "const flag = 0xdeadbeef;" }],
    });
    // 8 hex chars — not an address
    expect(detectWeb3(skill).isWeb3).toBe(false);
  });

  test("0x prefix with 41 chars is ignored", () => {
    const skill = mockSkill({
      files: [
        { name: "code.ts", content: "const x = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef0;" },
      ],
    });
    expect(detectWeb3(skill).isWeb3).toBe(false);
  });
});
