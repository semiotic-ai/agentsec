import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest, Web3ManifestBlock } from "@agentsec/shared";
import { checkAuditSink } from "../rules/audit-sink";

interface MockOptions {
  manifest?: Partial<SkillManifest>;
  web3?: Web3ManifestBlock | null;
  files?: { name: string; code: string }[];
  version?: string;
}

function mockSkill(opts: MockOptions = {}): AgentSkill {
  const manifest: SkillManifest = {
    name: "test-skill",
    version: opts.version ?? "1.2.3",
    description: "test",
    ...opts.manifest,
  };
  if (opts.web3 !== null) {
    manifest.web3 = opts.web3 ?? {
      chains: [1],
      signers: ["session"],
      audit: { sink: "https://audit.example/sink" },
      killSwitch: { contract: "0x000000000000000000000000000000000000dEaD", chainId: 1 },
      incident: { runbook: "https://runbooks.example/web3" },
    };
  }
  const files = opts.files ?? [];
  return {
    id: "test-skill",
    name: "Test Skill",
    version: manifest.version,
    path: "/tmp/test-skill",
    platform: "openclaw",
    manifest,
    files: files.map((f) => ({
      path: `/tmp/test-skill/${f.name}`,
      relativePath: f.name,
      content: f.code,
      language: "typescript",
      size: f.code.length,
    })),
  };
}

describe("AST-W12: audit-sink", () => {
  test("flags W12-001 when web3 block is present without an audit sink", () => {
    const skill = mockSkill({
      web3: {
        chains: [1],
        killSwitch: { contract: "0x000000000000000000000000000000000000dEaD", chainId: 1 },
        incident: { runbook: "https://runbooks.example/web3" },
      },
    });
    const findings = checkAuditSink(skill);
    const audit = findings.filter((f) => f.id.startsWith("W12-001"));
    expect(audit.length).toBe(1);
    expect(audit[0].severity).toBe("high");
    expect(audit[0].rule).toBe("web3-no-audit-killswitch");
    expect(audit[0].category).toBe("web3-no-audit-killswitch");
  });

  test("flags W12-001 when audit object exists but sink string is missing", () => {
    const skill = mockSkill({
      web3: {
        chains: [1],
        audit: {},
        killSwitch: { contract: "0x000000000000000000000000000000000000dEaD" },
        incident: { runbook: "https://runbook" },
      },
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-001"));
    expect(findings.length).toBe(1);
  });

  test("flags W12-002 when killSwitch contract is missing", () => {
    const skill = mockSkill({
      web3: {
        chains: [1],
        audit: { sink: "https://audit" },
        killSwitch: {},
        incident: { runbook: "https://runbook" },
      },
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-002"));
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("high");
  });

  test("flags W12-003 when incident.runbook is missing", () => {
    const skill = mockSkill({
      web3: {
        chains: [1],
        audit: { sink: "https://audit" },
        killSwitch: { contract: "0x000000000000000000000000000000000000dEaD" },
      },
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-003"));
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("medium");
  });

  test("does not flag any manifest finding when web3 block is fully populated", () => {
    const skill = mockSkill({
      files: [{ name: "noop.ts", code: "export const x = 1;" }],
    });
    const findings = checkAuditSink(skill);
    expect(findings.length).toBe(0);
  });

  test("does not flag manifest findings when web3 block is entirely absent", () => {
    const skill = mockSkill({ web3: null });
    const findings = checkAuditSink(skill);
    expect(findings.length).toBe(0);
  });

  test("flags W12-010 when sendTransaction is called without an audit token", () => {
    const skill = mockSkill({
      web3: null,
      files: [
        {
          name: "signer.ts",
          code: "export async function go() {\n  await wallet.sendTransaction({ to });\n}",
        },
      ],
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-010"));
    expect(findings.length).toBe(1);
    expect(findings[0].file).toBe("signer.ts");
    expect(findings[0].severity).toBe("medium");
  });

  test("does not flag W12-010 when an audit-shaped sink call is present in the same file", () => {
    // The W12 audit-token pattern requires sink-shaped phrasing — `logger.log('audit')`
    // (a generic console call) no longer qualifies. Use the canonical
    // `audit.record(...)` / `journal.record(...)` / `emit AuditEvent(...)` shapes.
    const skill = mockSkill({
      web3: null,
      files: [
        {
          name: "signer.ts",
          code: "audit.record({event:'sign'});\nawait wallet.sendTransaction({ to });",
        },
      ],
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-010"));
    expect(findings.length).toBe(0);
  });

  test("flags W12-010 when only a generic console.log is present (no sink-shaped call)", () => {
    const skill = mockSkill({
      web3: null,
      files: [
        {
          name: "signer.ts",
          // Bare console.log used to pass the audit-token regex; the tightened
          // version requires sink-shaped phrasing so this should now fire.
          code: "console.log('hi');\nawait wallet.sendTransaction({ to });",
        },
      ],
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-010"));
    expect(findings.length).toBe(1);
  });

  test("flags W12-011 when a signing function lacks any policyVersion/correlation token", () => {
    const skill = mockSkill({
      web3: null,
      files: [
        {
          name: "sign.ts",
          code: "logger.log('hi');\nasync function signTx(tx) { return wallet.signTransaction(tx); }",
        },
      ],
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-011"));
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("low");
  });

  test("does not flag W12-011 when a policyVersion token is present", () => {
    const skill = mockSkill({
      web3: null,
      files: [
        {
          name: "sign.ts",
          code: "const policyVersion = 'v3';\nlogger.log('audit', policyVersion);\nasync function signTx(tx) { return wallet.signTransaction(tx); }",
        },
      ],
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-011"));
    expect(findings.length).toBe(0);
  });

  test("flags W12-020 when SKILL.md claims autonomy but kill switch is missing", () => {
    const skill = mockSkill({
      web3: {
        chains: [1],
        audit: { sink: "https://audit" },
        incident: { runbook: "https://runbook" },
      },
      files: [
        {
          name: "SKILL.md",
          code: "# Skill\nThis skill is fully autonomous and signs on-chain transfers.",
        },
      ],
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-020"));
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("medium");
    expect(findings[0].file).toBe("SKILL.md");
  });

  test("does not flag W12-020 when autonomy claim is paired with a real kill switch", () => {
    const skill = mockSkill({
      files: [
        {
          name: "SKILL.md",
          code: "This automated skill emits an audit log per call.",
        },
      ],
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-020"));
    expect(findings.length).toBe(0);
  });

  test("flags W12-030 when web3-capable skill version is a stub like 0.0.0", () => {
    const skill = mockSkill({
      version: "0.0.0",
    });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-030"));
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("low");
  });

  test("does not flag W12-030 for a real semver version", () => {
    const skill = mockSkill({ version: "1.0.0" });
    const findings = checkAuditSink(skill).filter((f) => f.id.startsWith("W12-030"));
    expect(findings.length).toBe(0);
  });

  test("emits unique IDs and correct rule/category fields across a degraded manifest", () => {
    const skill = mockSkill({
      version: "0.1.0",
      web3: {
        chains: [1],
      },
    });
    const findings = checkAuditSink(skill);
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of findings) {
      expect(f.rule).toBe("web3-no-audit-killswitch");
      expect(f.category).toBe("web3-no-audit-killswitch");
      expect(f.id.startsWith("W12-")).toBe(true);
    }
    // W12-001, W12-002, W12-003, W12-030 all expected for a near-empty web3 block.
    expect(ids.some((id) => id.startsWith("W12-001"))).toBe(true);
    expect(ids.some((id) => id.startsWith("W12-002"))).toBe(true);
    expect(ids.some((id) => id.startsWith("W12-003"))).toBe(true);
    expect(ids.some((id) => id.startsWith("W12-030"))).toBe(true);
  });
});
