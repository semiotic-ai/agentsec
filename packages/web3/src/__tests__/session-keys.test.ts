import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest, Web3ManifestBlock } from "@agentsec/shared";
import { checkSessionKeys } from "../rules/session-keys";

function mockSkill(
  code: string,
  filename = "index.ts",
  manifest?: Partial<SkillManifest>,
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

function mockSkillManifestOnly(web3: Web3ManifestBlock): AgentSkill {
  return mockSkill("", "index.ts", { web3 });
}

/**
 * A "fully populated, well-formed" sessionKey: every field set, expiry within
 * window, enforcer allowlisted. The `caveatEnforcer` value is the canonical
 * MetaMask Smart Account v1 address from `data/delegate-targets.json` —
 * that file is the source of truth the rule reads from at startup.
 */
function goodSessionKey(): NonNullable<Web3ManifestBlock["sessionKey"]> {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    expiry: nowSec + 3600, // 1 hour out — well under 7 days
    valueLimit: "1000000000000000000",
    targets: ["0x1111111111111111111111111111111111111111"],
    selectors: ["0x38ed1739"],
    chainIds: [1, 8453],
    // MetaMask Smart Account v1 — listed in delegate-targets.json
    caveatEnforcer: "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B",
  };
}

// ---------------------------------------------------------------------------
// W09-001 — missing expiry
// ---------------------------------------------------------------------------
describe("Session keys: W09-001 missing expiry", () => {
  test("flags sessionKey declared without expiry", () => {
    const sk = goodSessionKey();
    const { expiry: _ignore, ...rest } = sk;
    const skill = mockSkillManifestOnly({ sessionKey: rest });
    const findings = checkSessionKeys(skill);
    const w001 = findings.filter((f) => f.id.startsWith("W09-001"));
    expect(w001.length).toBe(1);
    expect(w001[0].severity).toBe("high");
    expect(w001[0].rule).toBe("web3-session-key-erosion");
    expect(w001[0].category).toBe("web3-session-key-erosion");
  });

  test("does not fire W09-001 when expiry is set", () => {
    const skill = mockSkillManifestOnly({ sessionKey: goodSessionKey() });
    const findings = checkSessionKeys(skill);
    expect(findings.filter((f) => f.id.startsWith("W09-001")).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W09-002 — unbounded / too-far-future expiry
// ---------------------------------------------------------------------------
describe("Session keys: W09-002 expiry too far in future or zero", () => {
  test("flags expiry === 0 (sentinel for no expiry)", () => {
    const sk = { ...goodSessionKey(), expiry: 0 };
    const skill = mockSkillManifestOnly({ sessionKey: sk });
    const findings = checkSessionKeys(skill);
    const w002 = findings.filter((f) => f.id.startsWith("W09-002"));
    expect(w002.length).toBe(1);
    expect(w002[0].severity).toBe("high");
  });

  test("flags expiry > 7 days from now", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // 30 days
    const sk = { ...goodSessionKey(), expiry: farFuture };
    const skill = mockSkillManifestOnly({ sessionKey: sk });
    const findings = checkSessionKeys(skill);
    const w002 = findings.filter((f) => f.id.startsWith("W09-002"));
    expect(w002.length).toBe(1);
  });

  test("does NOT flag expiry within 7 days", () => {
    const within = Math.floor(Date.now() / 1000) + 6 * 24 * 3600; // 6 days
    const sk = { ...goodSessionKey(), expiry: within };
    const skill = mockSkillManifestOnly({ sessionKey: sk });
    const findings = checkSessionKeys(skill);
    expect(findings.filter((f) => f.id.startsWith("W09-002")).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W09-003 — missing valueLimit
// ---------------------------------------------------------------------------
describe("Session keys: W09-003 missing valueLimit", () => {
  test("flags sessionKey without valueLimit", () => {
    const sk = goodSessionKey();
    const { valueLimit: _ignore, ...rest } = sk;
    const skill = mockSkillManifestOnly({ sessionKey: rest });
    const findings = checkSessionKeys(skill);
    const w003 = findings.filter((f) => f.id.startsWith("W09-003"));
    expect(w003.length).toBe(1);
    expect(w003[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// W09-004 / W09-005 / W09-006 — missing or empty targets / selectors / chainIds
// ---------------------------------------------------------------------------
describe("Session keys: W09-004/005/006 empty or missing allowlists", () => {
  test("flags missing targets (W09-004) and empty selectors (W09-005)", () => {
    const sk = { ...goodSessionKey(), targets: undefined, selectors: [] };
    const skill = mockSkillManifestOnly({ sessionKey: sk });
    const findings = checkSessionKeys(skill);
    const w004 = findings.filter((f) => f.id.startsWith("W09-004"));
    const w005 = findings.filter((f) => f.id.startsWith("W09-005"));
    expect(w004.length).toBe(1);
    expect(w004[0].severity).toBe("high");
    expect(w005.length).toBe(1);
    expect(w005[0].severity).toBe("medium");
  });

  test("flags empty chainIds (W09-006)", () => {
    const sk = { ...goodSessionKey(), chainIds: [] };
    const skill = mockSkillManifestOnly({ sessionKey: sk });
    const findings = checkSessionKeys(skill);
    const w006 = findings.filter((f) => f.id.startsWith("W09-006"));
    expect(w006.length).toBe(1);
    expect(w006[0].severity).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// W09-007 — unknown caveat enforcer
// ---------------------------------------------------------------------------
describe("Session keys: W09-007 unknown caveat enforcer", () => {
  test("flags caveatEnforcer not in v0 allowlist", () => {
    const sk = {
      ...goodSessionKey(),
      caveatEnforcer: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    };
    const skill = mockSkillManifestOnly({ sessionKey: sk });
    const findings = checkSessionKeys(skill);
    const w007 = findings.filter((f) => f.id.startsWith("W09-007"));
    expect(w007.length).toBe(1);
    expect(w007[0].severity).toBe("medium");
  });

  test("does not fire when caveatEnforcer matches an allowlist entry (case-insensitive)", () => {
    // MetaMask Smart Account v1 in upper-cased form — the rule lower-cases
    // both sides before comparing, so this should still be allowlisted.
    const sk = {
      ...goodSessionKey(),
      caveatEnforcer: "0x63C0C19A282A1B52B07DD5A65B58948A07DAE32B",
    };
    const skill = mockSkillManifestOnly({ sessionKey: sk });
    const findings = checkSessionKeys(skill);
    expect(findings.filter((f) => f.id.startsWith("W09-007")).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W09-010 / W09-011 — code-level requestPermissions checks
// ---------------------------------------------------------------------------
describe("Session keys: W09-010/011 requestPermissions code patterns", () => {
  test("W09-010 fires when requestPermissions is called with no nearby expiry", () => {
    const skill = mockSkill(`
import { wallet } from "viem";
await wallet.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
`);
    const findings = checkSessionKeys(skill);
    const w010 = findings.filter((f) => f.id.startsWith("W09-010"));
    expect(w010.length).toBe(1);
    expect(w010[0].severity).toBe("high");
    expect(w010[0].file).toBe("index.ts");
    expect(typeof w010[0].line).toBe("number");
  });

  test("W09-010 does NOT fire when expiry is mentioned within 500 chars of the call", () => {
    const skill = mockSkill(`
const expiry = Math.floor(Date.now() / 1000) + 3600;
await provider.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {}, expiry }] });
`);
    const findings = checkSessionKeys(skill);
    expect(findings.filter((f) => f.id.startsWith("W09-010")).length).toBe(0);
  });

  test("W09-011 fires when requestPermissions is paired with `expiry: undefined`", () => {
    const skill = mockSkill(`
await provider.requestPermissions({ accounts: {}, expiry: undefined });
`);
    const findings = checkSessionKeys(skill);
    const w011 = findings.filter((f) => f.id.startsWith("W09-011"));
    expect(w011.length).toBe(1);
    expect(w011[0].severity).toBe("high");
  });

  test("W09-011 fires when requestPermissions is paired with `expiry: null`", () => {
    const skill = mockSkill(`
await provider.requestPermissions({ accounts: {}, expiry: null });
`);
    const findings = checkSessionKeys(skill);
    const w011 = findings.filter((f) => f.id.startsWith("W09-011"));
    expect(w011.length).toBe(1);
  });

  test("ignores requestPermissions inside a comment", () => {
    const skill = mockSkill(`
// previously: provider.requestPermissions({ accounts: {} });
const x = 1;
`);
    const findings = checkSessionKeys(skill);
    expect(
      findings.filter((f) => f.id.startsWith("W09-010") || f.id.startsWith("W09-011")).length,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Aggregate / clean-skill behaviour
// ---------------------------------------------------------------------------
describe("Session keys: aggregate behavior", () => {
  test("returns no findings for a fully-specified, well-formed sessionKey and clean code", () => {
    const skill = mockSkill("export const noop = () => 1;\n", "index.ts", {
      web3: { sessionKey: goodSessionKey() },
    });
    const findings = checkSessionKeys(skill);
    expect(findings.length).toBe(0);
  });

  test("returns no findings when no sessionKey block is declared and no requestPermissions call exists", () => {
    const skill = mockSkill("export const noop = () => 1;\n");
    const findings = checkSessionKeys(skill);
    expect(findings.length).toBe(0);
  });

  test("findings have unique ids and required structure", () => {
    const skill = mockSkillManifestOnly({ sessionKey: {} });
    const findings = checkSessionKeys(skill);
    expect(findings.length).toBeGreaterThan(0);
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of findings) {
      expect(f.rule).toBe("web3-session-key-erosion");
      expect(f.category).toBe("web3-session-key-erosion");
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(typeof f.remediation).toBe("string");
    }
  });
});
