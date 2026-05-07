import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest, Web3ManifestBlock } from "@agentsec/shared";
import { checkMetadataCompleteness } from "../metadata-completeness";

interface MockOptions {
  manifest?: Partial<SkillManifest>;
  /** `null` strips the field entirely; `undefined` (or omitted) keeps the default. */
  web3?: Web3ManifestBlock | null;
  metadata?: unknown | null;
  license?: string | null;
  permissions?: string[] | null;
}

function mockSkill(opts: MockOptions = {}): AgentSkill {
  // Sensible "everything-present" defaults; each test overrides what it
  // wants to remove. `null` for any field means "strip it"; mirrors the
  // audit-sink test helper style.
  const manifest: SkillManifest = {
    name: "test-skill",
    version: "1.2.3",
    description: "test",
    license: opts.license === null ? undefined : (opts.license ?? "MIT"),
    permissions: opts.permissions === null ? undefined : (opts.permissions ?? ["network:fetch"]),
    ...opts.manifest,
  };

  if (opts.metadata !== null) {
    (manifest as Record<string, unknown>).metadata = opts.metadata ?? {
      openclaw: { tags: ["web3"] },
    };
  }

  if (opts.web3 !== null) {
    manifest.web3 = opts.web3 ?? {
      chains: [1],
      policy: {
        allowedContracts: ["0x6fF5693b99212Da76ad316178A184AB56D299b43"],
      },
    };
  }

  return {
    id: "test-skill",
    name: "Test Skill",
    version: manifest.version,
    path: "/tmp/test-skill",
    platform: "openclaw",
    manifest,
    files: [],
  };
}

describe("AST04 (web3 tightening): metadata-completeness", () => {
  test("does not fire on a fully-populated manifest (regression for good-web3-skill)", () => {
    const skill = mockSkill();
    const findings = checkMetadataCompleteness(skill);
    expect(findings.length).toBe(0);
  });

  test("fires missing-license when license is undefined", () => {
    const skill = mockSkill({ license: null });
    const findings = checkMetadataCompleteness(skill);
    const licenseFindings = findings.filter((f) => f.id.startsWith("W04M-001"));
    expect(licenseFindings.length).toBe(1);
    expect(licenseFindings[0].severity).toBe("medium");
    expect(licenseFindings[0].rule).toBe("web3-metadata-completeness");
    expect(licenseFindings[0].category).toBe("web3-metadata-completeness");
  });

  test("fires missing-license when license is `UNKNOWN`", () => {
    const skill = mockSkill({ license: "UNKNOWN" });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-001"));
    expect(findings.length).toBe(1);
  });

  test("fires missing-license when license is the empty string", () => {
    const skill = mockSkill({ license: "" });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-001"));
    expect(findings.length).toBe(1);
  });

  test("does not fire missing-license for a real SPDX value", () => {
    const skill = mockSkill({ license: "Apache-2.0" });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-001"));
    expect(findings.length).toBe(0);
  });

  test("fires missing-permissions when permissions array is empty", () => {
    const skill = mockSkill({ permissions: [] });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-002"));
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("medium");
  });

  test("fires missing-permissions when permissions is undefined", () => {
    const skill = mockSkill({ permissions: null });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-002"));
    expect(findings.length).toBe(1);
  });

  test("does not fire missing-permissions when at least one permission is declared", () => {
    const skill = mockSkill({ permissions: ["network:fetch"] });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-002"));
    expect(findings.length).toBe(0);
  });

  test("fires missing-openclaw when metadata is undefined", () => {
    const skill = mockSkill({ metadata: null });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-003"));
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("low");
  });

  test("fires missing-openclaw when metadata exists but has no `openclaw` key", () => {
    const skill = mockSkill({ metadata: { other: "stuff" } });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-003"));
    expect(findings.length).toBe(1);
  });

  test("fires missing-openclaw when metadata.openclaw is an empty object", () => {
    // Empty object is "present but unhelpful" — treat as missing.
    const skill = mockSkill({ metadata: { openclaw: {} } });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-003"));
    expect(findings.length).toBe(1);
  });

  test("does not fire missing-openclaw when metadata.openclaw has fields", () => {
    const skill = mockSkill({ metadata: { openclaw: { tags: ["web3"] } } });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-003"));
    expect(findings.length).toBe(0);
  });

  test("fires missing-allowed-contracts when web3 block is entirely absent", () => {
    const skill = mockSkill({ web3: null });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-004"));
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("medium");
  });

  test("fires missing-allowed-contracts when web3.policy is absent", () => {
    const skill = mockSkill({ web3: { chains: [1] } });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-004"));
    expect(findings.length).toBe(1);
  });

  test("fires missing-allowed-contracts when policy.allowedContracts is empty", () => {
    const skill = mockSkill({ web3: { chains: [1], policy: { allowedContracts: [] } } });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-004"));
    expect(findings.length).toBe(1);
  });

  test("does not fire missing-allowed-contracts when allowedContracts has at least one entry", () => {
    const skill = mockSkill({
      web3: {
        chains: [1],
        policy: { allowedContracts: ["0x6fF5693b99212Da76ad316178A184AB56D299b43"] },
      },
    });
    const findings = checkMetadataCompleteness(skill).filter((f) => f.id.startsWith("W04M-004"));
    expect(findings.length).toBe(0);
  });

  test("fires all four findings on a deliberately-bare manifest", () => {
    const skill = mockSkill({ license: null, permissions: null, metadata: null, web3: null });
    const findings = checkMetadataCompleteness(skill);
    expect(findings.length).toBe(4);

    const ids = findings.map((f) => f.id);
    expect(ids.some((id) => id.startsWith("W04M-001"))).toBe(true);
    expect(ids.some((id) => id.startsWith("W04M-002"))).toBe(true);
    expect(ids.some((id) => id.startsWith("W04M-003"))).toBe(true);
    expect(ids.some((id) => id.startsWith("W04M-004"))).toBe(true);

    // Stable shape: every finding carries the rule + category labels and a
    // unique id so SARIF / JSON consumers can deduplicate cleanly.
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of findings) {
      expect(f.rule).toBe("web3-metadata-completeness");
      expect(f.category).toBe("web3-metadata-completeness");
      expect(f.file).toBe("skill.json");
    }
  });
});
