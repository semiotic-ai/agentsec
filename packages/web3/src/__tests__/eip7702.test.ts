import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { checkEip7702 } from "../rules/eip7702";

function mockSkill(
  code: string,
  filename = "index.ts",
  manifest: Partial<SkillManifest> = {},
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
      ...manifest,
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

describe("EIP-7702: manifest declaration", () => {
  test("flags signs7702 without allowedContracts or expiry as critical", () => {
    const skill = mockSkill("", "index.ts", {
      web3: { signs7702: true },
    });
    const findings = checkEip7702(skill);
    const hits = findings.filter((f) => f.id.startsWith("W03-001"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("critical");
    expect(hits[0].rule).toBe("web3-eip7702-delegation");
    expect(hits[0].category).toBe("web3-eip7702-delegation");
    expect(hits[0].file).toBeUndefined();
  });

  test("does not flag W03-001 when allowedContracts and expiry are present", () => {
    const skill = mockSkill("", "index.ts", {
      web3: {
        signs7702: true,
        policy: {
          allowedContracts: ["0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B"],
          expiry: 1735689600,
        },
      },
    });
    const findings = checkEip7702(skill);
    expect(findings.filter((f) => f.id.startsWith("W03-001")).length).toBe(0);
  });

  test("does not flag W03-001 when signs7702 is false", () => {
    const skill = mockSkill("", "index.ts", {
      web3: { signs7702: false },
    });
    const findings = checkEip7702(skill);
    expect(findings.filter((f) => f.id.startsWith("W03-001")).length).toBe(0);
  });
});

describe("EIP-7702: code-level SetCodeAuthorization detection", () => {
  test("flags SetCodeAuthorization pointing at unknown delegate as critical", () => {
    const skill = mockSkill(`
const auth = await wallet.signAuthorization({
  address: "0xDEADBEEFcafe1234567890abcdef1234567890Ab",
  chainId: 1,
  expiry: 1735689600,
});
`);
    const findings = checkEip7702(skill);
    const hits = findings.filter((f) => f.id.startsWith("W03-002"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("critical");
    expect(hits[0].file).toBe("index.ts");
    expect(hits[0].line).toBeGreaterThan(0);
  });

  test("does not flag W03-002 when delegate is on the allowlist", () => {
    const skill = mockSkill(`
const auth = await signAuthorization({
  address: "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B",
  chainId: 1,
  expiry: 1735689600,
});
`);
    const findings = checkEip7702(skill);
    expect(findings.filter((f) => f.id.startsWith("W03-002")).length).toBe(0);
  });

  test("flags chainId = 0 as cross-chain replayable (high)", () => {
    const skill = mockSkill(`
const auth = await signAuthorization({
  address: "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B",
  chainId: 0,
  expiry: 1735689600,
});
`);
    const findings = checkEip7702(skill);
    const hits = findings.filter((f) => f.id.startsWith("W03-003"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });

  test("flags missing expiry/revokeAfter near SetCodeAuthorization (high)", () => {
    const skill = mockSkill(`
const auth = await signAuthorization({
  address: "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B",
  chainId: 1,
  nonce: 0,
});
`);
    const findings = checkEip7702(skill);
    const hits = findings.filter((f) => f.id.startsWith("W03-005"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });

  test("does not flag W03-005 when revokeAfter is nearby", () => {
    const skill = mockSkill(`
const auth = await signAuthorization({
  address: "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B",
  chainId: 1,
  revokeAfter: Date.now() + 60_000,
});
`);
    const findings = checkEip7702(skill);
    expect(findings.filter((f) => f.id.startsWith("W03-005")).length).toBe(0);
  });

  test("ignores SetCodeAuthorization references inside comments", () => {
    const skill = mockSkill(`
// Avoid calling SetCodeAuthorization with untrusted addresses.
const safe = 1;
`);
    const findings = checkEip7702(skill);
    expect(findings.length).toBe(0);
  });
});

describe("EIP-7702: designator prefix and prose hints", () => {
  test("flags raw 0xef0100 designator literal as medium", () => {
    const skill = mockSkill(`
const designator = "0xef0100" + targetAddress.slice(2);
`);
    const findings = checkEip7702(skill);
    const hits = findings.filter((f) => f.id.startsWith("W03-004"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("medium");
    expect(hits[0].file).toBe("index.ts");
  });

  test("flags 'wallet upgrade' prose when signs7702 is undeclared (medium)", () => {
    const skill = mockSkill(
      "Walk the user through the wallet upgrade flow to enable smart features.",
      "SKILL.md",
    );
    const findings = checkEip7702(skill);
    const hits = findings.filter((f) => f.id.startsWith("W03-010"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("medium");
  });

  test("does not flag W03-010 when signs7702 is declared in manifest", () => {
    const skill = mockSkill(
      "This skill performs a wallet upgrade for gas sponsorship support.",
      "SKILL.md",
      {
        web3: {
          signs7702: true,
          policy: {
            allowedContracts: ["0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B"],
            expiry: 1735689600,
          },
        },
      },
    );
    const findings = checkEip7702(skill);
    expect(findings.filter((f) => f.id.startsWith("W03-010")).length).toBe(0);
  });
});

describe("EIP-7702: finding structure and clean cases", () => {
  test("clean code with no 7702 markers produces no findings", () => {
    const skill = mockSkill(`
import { ethers } from "ethers";
const balance = await provider.getBalance(addr);
`);
    const findings = checkEip7702(skill);
    expect(findings.length).toBe(0);
  });

  test("every finding has unique id and required fields", () => {
    const skill = mockSkill(
      `
const auth = await signAuthorization({
  address: "0xDEADBEEFcafe1234567890abcdef1234567890Ab",
  chainId: 0,
});
const designator = "0xef0100abcdef";
`,
      "index.ts",
      { web3: { signs7702: true } },
    );
    const findings = checkEip7702(skill);
    expect(findings.length).toBeGreaterThan(1);
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of findings) {
      expect(f.rule).toBe("web3-eip7702-delegation");
      expect(f.category).toBe("web3-eip7702-delegation");
      expect(f.severity).toBeDefined();
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(f.remediation).toBeDefined();
    }
  });
});
