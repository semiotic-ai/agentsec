import { describe, expect, test } from "bun:test";
import type { AgentSkill } from "@agentsec/shared";
import { checkTypedData } from "../rules/typed-data";

function mockSkill(code: string, filename = "index.ts"): AgentSkill {
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
    },
    files: [
      {
        path: `/tmp/test-skill/${filename}`,
        relativePath: filename,
        content: code,
        language: "typescript",
        size: code.length,
      },
    ],
  };
}

function mockSkillMultiFile(files: { name: string; code: string }[]): AgentSkill {
  return {
    id: "multi-skill",
    name: "Multi File Skill",
    version: "1.0.0",
    path: "/tmp/multi-skill",
    platform: "openclaw",
    manifest: { name: "multi-skill", version: "1.0.0" },
    files: files.map((f) => ({
      path: `/tmp/multi-skill/${f.name}`,
      relativePath: f.name,
      content: f.code,
      language: f.name.endsWith(".md") ? "markdown" : "typescript",
      size: f.code.length,
    })),
  };
}

describe("AST-W04: personal_sign / eth_sign detection", () => {
  test("detects personal_sign call", () => {
    const skill = mockSkill(`
import { viem } from "viem";
await wallet.request({ method: "personal_sign", params: [msg, addr] });
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-001"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].rule).toBe("web3-blind-signing");
    expect(hits[0].category).toBe("web3-blind-signing");
  });

  test("detects eth_sign call", () => {
    const skill = mockSkill(`provider.request({ method: "eth_sign", params: [addr, msg] });`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-001"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  test("ignores personal_sign mentioned only in a comment", () => {
    const skill = mockSkill(`
// Never use personal_sign here, prefer signTypedData_v4
import { hashTypedData } from "viem";
const hash = hashTypedData({ domain: { chainId: 1, verifyingContract: addr }, types, message });
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-001"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W04: typed-data payload from untrusted JSON.stringify", () => {
  test("flags signTypedData(JSON.stringify(model_output))", () => {
    const skill = mockSkill(`
import { signTypedData } from "viem";
await signTypedData(JSON.stringify(modelOutput));
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-002"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("high");
  });

  test("flags signTypedData with template literal interpolating user input", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill(
      'import { signTypedData } from "viem";\nsignTypedData(`payload ${userInput}`);',
    );
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-002"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag signTypedData with a fixed schema object", () => {
    const skill = mockSkill(`
import { signTypedData } from "viem";
await signTypedData({
  domain: { name: "App", version: "1", chainId: 1, verifyingContract: target },
  types: { Order: [{ name: "amount", type: "uint256" }] },
  primaryType: "Order",
  message: { amount },
});
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-002"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W04: EIP-712 domain field checks", () => {
  test("flags domain missing chainId", () => {
    const skill = mockSkill(`
import { signTypedData } from "viem";
const data = {
  domain: { name: "App", version: "1", verifyingContract: target },
  types,
  primaryType: "Order",
  message: order,
};
await signTypedData(data);
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-003"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("high");
  });

  test("flags domain missing verifyingContract", () => {
    const skill = mockSkill(`
import { signTypedData } from "viem";
const data = {
  domain: { name: "App", version: "1", chainId: 1 },
  types,
  primaryType: "Order",
  message: order,
};
await signTypedData(data);
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-004"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("medium");
  });

  test("complete domain produces no W04-003 or W04-004 findings", () => {
    const skill = mockSkill(`
import { signTypedData } from "viem";
const data = {
  domain: { name: "App", version: "1", chainId: 1, verifyingContract: target },
  types,
  primaryType: "Order",
  message: order,
};
await signTypedData(data);
`);
    const findings = checkTypedData(skill);
    const domainHits = findings.filter(
      (f) => f.id.startsWith("W04-003") || f.id.startsWith("W04-004"),
    );
    expect(domainHits.length).toBe(0);
  });
});

describe("AST-W04: missing canonical hasher import", () => {
  test("flags signTypedData without viem/ethers/eth-sig-util import", () => {
    const skill = mockSkill(`
import { logger } from "./log";
async function sign(req) {
  return await wallet.signTypedData(req.domain, req.types, req.message);
}
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-005"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("medium");
  });

  test("does not flag when viem hashTypedData helper is imported", () => {
    const skill = mockSkill(`
import { hashTypedData, signTypedData } from "viem";
const hash = hashTypedData(typed);
await signTypedData(typed);
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-005"));
    expect(hits.length).toBe(0);
  });

  test("does not flag when ethers/utils is imported", () => {
    const skill = mockSkill(`
import { TypedDataEncoder } from "ethers/utils";
TypedDataEncoder.hash(domain, types, message);
wallet.signTypedData(domain, types, message);
`);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-005"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W04: cross-file blind sign heuristic", () => {
  test("flags md prompt 'sign this message' alongside code that uses personal_sign", () => {
    const skill = mockSkillMultiFile([
      {
        name: "SKILL.md",
        code: "# Wallet Skill\n\nWhen the user asks, prompt them: please sign this message to continue.",
      },
      {
        name: "index.ts",
        code: 'await provider.request({ method: "personal_sign", params: [msg, addr] });',
      },
    ]);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-006"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("medium");
    expect(hits[0].file).toBe("SKILL.md");
  });

  test("md alone with sign language but no raw-sign code does not fire", () => {
    const skill = mockSkillMultiFile([
      {
        name: "SKILL.md",
        code: "Please sign this message after review.",
      },
      {
        name: "index.ts",
        code: 'import { signTypedData } from "viem";\nawait signTypedData({ domain: { chainId: 1, verifyingContract: a }, types, message });',
      },
    ]);
    const findings = checkTypedData(skill);
    const hits = findings.filter((f) => f.id.startsWith("W04-006"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W04: finding structure", () => {
  test("every finding carries rule and category metadata", () => {
    const skill = mockSkill(`
provider.request({ method: "personal_sign", params: [m, a] });
const data = { domain: { name: "A", version: "1" }, types, message };
wallet.signTypedData(data);
`);
    const findings = checkTypedData(skill);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.rule).toBe("web3-blind-signing");
      expect(f.category).toBe("web3-blind-signing");
      expect(f.id).toMatch(/^W04-\d{3}-\d+$/);
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(f.remediation).toBeDefined();
    }
  });

  test("clean signTypedData usage produces no findings", () => {
    const skill = mockSkill(`
import { signTypedData, hashTypedData } from "viem";
const typed = {
  domain: { name: "App", version: "1", chainId: 1, verifyingContract: target },
  types: { Order: [{ name: "amount", type: "uint256" }] },
  primaryType: "Order",
  message: { amount: 100n },
};
const hash = hashTypedData(typed);
await signTypedData(typed);
`);
    const findings = checkTypedData(skill);
    expect(findings.length).toBe(0);
  });
});
