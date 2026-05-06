import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { checkBridge } from "../rules/bridge";

interface MockFile {
  name: string;
  content: string;
}

function mockSkill(
  manifestOverride: Partial<SkillManifest> = {},
  files: MockFile[] = [],
): AgentSkill {
  return {
    id: "test-skill",
    name: "Test Skill",
    version: "1.0.0",
    path: "/tmp/test-skill",
    platform: "openclaw",
    manifest: {
      name: "test-skill",
      version: "1.0.0",
      description: "A test skill",
      ...manifestOverride,
    },
    files: files.map((f) => ({
      path: `/tmp/test-skill/${f.name}`,
      relativePath: f.name,
      content: f.content,
      language: f.name.endsWith(".md") ? "markdown" : "typescript",
      size: f.content.length,
    })),
  };
}

describe("AST-W07: manifest-level signals", () => {
  test("W07-001 fires when web3.chains has length >= 2 and bridgeProvider missing", () => {
    const skill = mockSkill({ web3: { chains: [1, 8453] } });
    const findings = checkBridge(skill);
    const hits = findings.filter((f) => f.id.startsWith("W07-001"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].rule).toBe("web3-bridge-replay");
    expect(hits[0].category).toBe("web3-bridge-replay");
  });

  test("W07-001 does NOT fire when bridgeProvider is declared", () => {
    const skill = mockSkill({
      web3: { chains: [1, 8453], bridgeProvider: "layerzero" },
    });
    const findings = checkBridge(skill);
    expect(findings.filter((f) => f.id.startsWith("W07-001")).length).toBe(0);
  });

  test("W07-001 does NOT fire for single-chain skills", () => {
    const skill = mockSkill({ web3: { chains: [1] } });
    const findings = checkBridge(skill);
    expect(findings.filter((f) => f.id.startsWith("W07-001")).length).toBe(0);
  });
});

describe("AST-W07: model-supplied destination chain", () => {
  test("W07-002 fires when dstChainId is a template literal interpolation", () => {
    const skill = mockSkill({}, [
      {
        name: "send.ts",
        content:
          "import { Stargate } from 'stargate';\n" +
          // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional fixture
          "await stargate.send({ dstChainId: `${userResponse.chain}`, amount });\n",
      },
    ]);
    const findings = checkBridge(skill);
    const hits = findings.filter((f) => f.id.startsWith("W07-002"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].file).toBe("send.ts");
  });

  test("W07-002 fires when dstEid sources from a model variable name", () => {
    const skill = mockSkill({}, [
      {
        name: "lz.ts",
        content:
          "import { LayerZero } from 'layerzero';\n" +
          "await lz.bridge({ dstEid: input.targetEid, payload });\n",
      },
    ]);
    const findings = checkBridge(skill);
    expect(findings.filter((f) => f.id.startsWith("W07-002")).length).toBeGreaterThanOrEqual(1);
  });

  test("W07-002 does NOT fire when there is no bridge library in the file", () => {
    const skill = mockSkill({}, [
      {
        name: "noop.ts",
        content:
          // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional fixture
          "const cfg = { dstChainId: `${input.chain}` };\n",
      },
    ]);
    const findings = checkBridge(skill);
    expect(findings.filter((f) => f.id.startsWith("W07-002")).length).toBe(0);
  });
});

describe("AST-W07: retry-without-idempotency", () => {
  test("W07-003 fires when bridge call sits in a retry function with no tracking", () => {
    const skill = mockSkill({}, [
      {
        name: "retry.ts",
        content:
          "async function attemptBridge() {\n" +
          "  for (let attempt = 0; attempt < 3; attempt++) {\n" +
          "    try {\n" +
          "      await wormhole.transfer({ amount, target });\n" +
          "    } catch (e) {\n" +
          "      await wait(1000);\n" +
          "    }\n" +
          "  }\n" +
          "}\n",
      },
    ]);
    const findings = checkBridge(skill);
    const hits = findings.filter((f) => f.id.startsWith("W07-003"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("high");
  });

  test("W07-003 does NOT fire when the function tracks messageId", () => {
    const skill = mockSkill({}, [
      {
        name: "retry.ts",
        content:
          "async function attemptBridge(messageId: string) {\n" +
          "  for (let attempt = 0; attempt < 3; attempt++) {\n" +
          "    try {\n" +
          "      await wormhole.transfer({ amount, target, messageId });\n" +
          "    } catch (e) {\n" +
          "      await wait(1000);\n" +
          "    }\n" +
          "  }\n" +
          "}\n",
      },
    ]);
    const findings = checkBridge(skill);
    expect(findings.filter((f) => f.id.startsWith("W07-003")).length).toBe(0);
  });
});

describe("AST-W07: verifyingContract allowlist", () => {
  test("W07-004 fires when verifyingContract is non-allowlisted next to bridge code", () => {
    const skill = mockSkill({}, [
      {
        name: "sign.ts",
        content:
          "import { LayerZero } from 'layerzero';\n" +
          "const domain = { name: 'Bridge', verifyingContract: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' };\n" +
          "await lz.send(domain, payload);\n",
      },
    ]);
    const findings = checkBridge(skill);
    const hits = findings.filter((f) => f.id.startsWith("W07-004"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("medium");
  });

  test("W07-004 does NOT fire when verifyingContract is the canonical LayerZero v2 endpoint", () => {
    const skill = mockSkill({}, [
      {
        name: "sign.ts",
        content:
          "import { LayerZero } from 'layerzero';\n" +
          "const domain = { name: 'Bridge', verifyingContract: '0x1a44076050125825900e736c501f859c50fE728c' };\n" +
          "await lz.send(domain, payload);\n",
      },
    ]);
    const findings = checkBridge(skill);
    expect(findings.filter((f) => f.id.startsWith("W07-004")).length).toBe(0);
  });
});

describe("AST-W07: prose mention without bridgeProvider", () => {
  test("W07-010 fires when SKILL.md mentions bridge and manifest has no bridgeProvider", () => {
    const skill = mockSkill({}, [
      {
        name: "SKILL.md",
        content: "# Helper\n\nThis skill helps you bridge USDC across chains.\n",
      },
    ]);
    const findings = checkBridge(skill);
    const hits = findings.filter((f) => f.id.startsWith("W07-010"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("medium");
    expect(hits[0].file).toBe("SKILL.md");
  });

  test("W07-010 does NOT fire when bridgeProvider is set", () => {
    const skill = mockSkill({ web3: { bridgeProvider: "ccip", chains: [1, 8453] } }, [
      {
        name: "SKILL.md",
        content: "Bridge USDC from L2 to L1 using CCIP.\n",
      },
    ]);
    const findings = checkBridge(skill);
    expect(findings.filter((f) => f.id.startsWith("W07-010")).length).toBe(0);
  });
});

describe("AST-W07: partial finality assumption", () => {
  test("W07-005 fires when setTimeout precedes a follow-up sendTransaction in bridge code", () => {
    const skill = mockSkill({}, [
      {
        name: "flow.ts",
        content:
          "import { Stargate } from 'stargate';\n" +
          "await stargate.send({ amount });\n" +
          "setTimeout(async () => {\n" +
          "  await wallet.sendTransaction({ to, data });\n" +
          "}, 30000);\n",
      },
    ]);
    const findings = checkBridge(skill);
    const hits = findings.filter((f) => f.id.startsWith("W07-005"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("medium");
  });

  test("W07-005 does NOT fire when the timeout is unrelated to a bridge / follow-up tx", () => {
    const skill = mockSkill({}, [
      {
        name: "flow.ts",
        content: "function poll() {\n" + "  setTimeout(() => console.log('tick'), 1000);\n" + "}\n",
      },
    ]);
    const findings = checkBridge(skill);
    expect(findings.filter((f) => f.id.startsWith("W07-005")).length).toBe(0);
  });
});

describe("AST-W07: finding structure", () => {
  test("clean multi-chain skill with all controls produces no findings", () => {
    const skill = mockSkill({ web3: { chains: [1, 8453], bridgeProvider: "layerzero" } }, [
      {
        name: "send.ts",
        content:
          "const ALLOWED_CHAINS = [1, 8453];\n" +
          "function bridge(messageId: string, dstChainId: number) {\n" +
          "  if (!ALLOWED_CHAINS.includes(dstChainId)) throw new Error('chain not allowed');\n" +
          "  return layerzero.send({ dstChainId, messageId });\n" +
          "}\n",
      },
    ]);
    const findings = checkBridge(skill);
    expect(findings.length).toBe(0);
  });

  test("every finding carries the canonical rule and unique ids", () => {
    const skill = mockSkill({ web3: { chains: [1, 8453] } }, [
      {
        name: "SKILL.md",
        content: "We bridge cross-chain assets for you.\n",
      },
      {
        name: "send.ts",
        content:
          "import { Hyperlane } from 'hyperlane';\n" +
          // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional fixture
          "await hyperlane.dispatch({ dstChainId: `${input.chain}`, payload });\n",
      },
    ]);
    const findings = checkBridge(skill);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.rule).toBe("web3-bridge-replay");
      expect(f.category).toBe("web3-bridge-replay");
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(typeof f.remediation).toBe("string");
    }
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
