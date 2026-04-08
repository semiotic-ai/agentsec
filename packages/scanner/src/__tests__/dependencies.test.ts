import { describe, expect, test } from "bun:test";
import type { AgentSkill } from "@agentsec/shared";
import { checkDependencies } from "../rules/dependencies";

/**
 * Helper to create a mock AgentSkill with specified manifest dependencies
 * and optional files.
 */
function mockSkill(
  deps: Record<string, string>,
  files?: { name: string; code: string }[],
): AgentSkill {
  const skillFiles = (files ?? []).map((f) => ({
    path: `/tmp/dep-test-skill/${f.name}`,
    relativePath: f.name,
    content: f.code,
    language: "typescript",
    size: f.code.length,
  }));

  return {
    id: "dep-test-skill",
    name: "Dependency Test Skill",
    version: "1.0.0",
    path: "/tmp/dep-test-skill",
    platform: "openclaw",
    manifest: {
      name: "dep-test-skill",
      version: "1.0.0",
      description: "A skill for dependency testing",
      dependencies: deps,
    },
    files: skillFiles,
  };
}

// ---------------------------------------------------------------------------
// Typosquatting detection
// ---------------------------------------------------------------------------
describe("Dependencies: typosquatting detection", () => {
  test("detects typosquat of lodash (l0dash)", () => {
    const skill = mockSkill({ l0dash: "^4.17.21" });
    const findings = checkDependencies(skill);
    const typoFindings = findings.filter((f) => f.id.startsWith("DEP-TYPO"));
    expect(typoFindings.length).toBeGreaterThanOrEqual(1);
    expect(typoFindings[0].severity).toBe("critical");
    expect(typoFindings[0].title).toContain("l0dash");
  });

  test("detects typosquat of express (expres)", () => {
    const skill = mockSkill({ expres: "^4.18.0" });
    const findings = checkDependencies(skill);
    const typoFindings = findings.filter((f) => f.id.startsWith("DEP-TYPO"));
    expect(typoFindings.length).toBeGreaterThanOrEqual(1);
    expect(typoFindings[0].severity).toBe("critical");
  });

  test("detects typosquat of react (raect)", () => {
    const skill = mockSkill({ raect: "^18.2.0" });
    const findings = checkDependencies(skill);
    const typoFindings = findings.filter((f) => f.id.startsWith("DEP-TYPO"));
    expect(typoFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects typosquat of axios (axois)", () => {
    const skill = mockSkill({ axois: "^1.6.0" });
    const findings = checkDependencies(skill);
    const typoFindings = findings.filter((f) => f.id.startsWith("DEP-TYPO"));
    expect(typoFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects typosquat of chalk (chalks)", () => {
    const skill = mockSkill({ chalks: "^5.0.0" });
    const findings = checkDependencies(skill);
    const typoFindings = findings.filter((f) => f.id.startsWith("DEP-TYPO"));
    expect(typoFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag legitimate package names as typosquats", () => {
    const skill = mockSkill({ lodash: "^4.17.21", express: "^4.18.2", react: "^18.2.0" });
    const findings = checkDependencies(skill);
    const typoFindings = findings.filter((f) => f.id.startsWith("DEP-TYPO"));
    expect(typoFindings.length).toBe(0);
  });

  test("detects typosquat of typescript (typscript)", () => {
    const skill = mockSkill({ typscript: "^5.0.0" });
    const findings = checkDependencies(skill);
    const typoFindings = findings.filter((f) => f.id.startsWith("DEP-TYPO"));
    expect(typoFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Unpinned version detection
// ---------------------------------------------------------------------------
describe("Dependencies: unpinned version detection", () => {
  test("detects wildcard (*) version", () => {
    const skill = mockSkill({ "some-package": "*" });
    const findings = checkDependencies(skill);
    const versionFindings = findings.filter((f) => f.id.startsWith("DEP-WILD"));
    expect(versionFindings.length).toBeGreaterThanOrEqual(1);
    expect(versionFindings[0].severity).toBe("high");
  });

  test("detects 'latest' version", () => {
    const skill = mockSkill({ "some-package": "latest" });
    const findings = checkDependencies(skill);
    const versionFindings = findings.filter((f) => f.id.startsWith("DEP-WILD"));
    expect(versionFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects empty version string", () => {
    const skill = mockSkill({ "some-package": "" });
    const findings = checkDependencies(skill);
    const versionFindings = findings.filter((f) => f.id.startsWith("DEP-WILD"));
    expect(versionFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects git URL dependency", () => {
    const skill = mockSkill({
      "my-lib": "git+https://github.com/user/repo.git",
    });
    const findings = checkDependencies(skill);
    const gitFindings = findings.filter((f) => f.id.startsWith("DEP-GIT"));
    expect(gitFindings.length).toBeGreaterThanOrEqual(1);
    expect(gitFindings[0].severity).toBe("high");
  });

  test("detects http URL dependency", () => {
    const skill = mockSkill({
      "my-pkg": "https://example.com/package.tgz",
    });
    const findings = checkDependencies(skill);
    const gitFindings = findings.filter((f) => f.id.startsWith("DEP-GIT"));
    expect(gitFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects github: shorthand dependency", () => {
    const skill = mockSkill({
      "my-fork": "github:user/repo#branch",
    });
    const findings = checkDependencies(skill);
    const gitFindings = findings.filter((f) => f.id.startsWith("DEP-GIT"));
    expect(gitFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("exact pinned version produces no unpinned findings", () => {
    const skill = mockSkill({ lodash: "4.17.21", express: "4.18.2" });
    const findings = checkDependencies(skill);
    const unpinnedFindings = findings.filter(
      (f) => f.id.startsWith("DEP-WILD") || f.id.startsWith("DEP-GIT"),
    );
    expect(unpinnedFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Known vulnerable packages
// ---------------------------------------------------------------------------
describe("Dependencies: known vulnerable package detection", () => {
  test("detects event-stream (supply chain compromise)", () => {
    const skill = mockSkill({ "event-stream": "3.3.6" });
    const findings = checkDependencies(skill);
    const vulnFindings = findings.filter((f) => f.id.startsWith("DEP-VULN"));
    expect(vulnFindings.length).toBeGreaterThanOrEqual(1);
    expect(vulnFindings[0].severity).toBe("critical");
    expect(vulnFindings[0].title).toContain("event-stream");
  });

  test("detects node-ipc (protestware)", () => {
    const skill = mockSkill({ "node-ipc": "^10.1.0" });
    const findings = checkDependencies(skill);
    const vulnFindings = findings.filter((f) => f.id.startsWith("DEP-VULN"));
    expect(vulnFindings.length).toBeGreaterThanOrEqual(1);
    expect(vulnFindings[0].severity).toBe("critical");
  });

  test("detects colors (sabotaged package)", () => {
    const skill = mockSkill({ colors: "^1.4.1" });
    const findings = checkDependencies(skill);
    const vulnFindings = findings.filter((f) => f.id.startsWith("DEP-VULN"));
    expect(vulnFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects deprecated package (request)", () => {
    const skill = mockSkill({ request: "^2.88.2" });
    const findings = checkDependencies(skill);
    const deprFindings = findings.filter((f) => f.id.startsWith("DEP-DEPR"));
    expect(deprFindings.length).toBeGreaterThanOrEqual(1);
    expect(deprFindings[0].severity).toBe("low");
  });

  test("safe packages produce no vulnerability findings", () => {
    const skill = mockSkill({
      zod: "3.22.4",
      "type-fest": "4.10.2",
    });
    const findings = checkDependencies(skill);
    const vulnFindings = findings.filter(
      (f) => f.id.startsWith("DEP-VULN") || f.id.startsWith("DEP-DEPR"),
    );
    expect(vulnFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Excessive dependency count
// ---------------------------------------------------------------------------
describe("Dependencies: excessive dependency count", () => {
  test("flags more than 30 dependencies", () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 31; i++) {
      deps[`safe-package-${i}`] = "1.0.0";
    }
    const skill = mockSkill(deps);
    const findings = checkDependencies(skill);
    const countFindings = findings.filter((f) => f.id === "DEP-COUNT");
    expect(countFindings.length).toBe(1);
    expect(countFindings[0].severity).toBe("medium");
  });

  test("30 or fewer dependencies does not flag excessive count", () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      deps[`safe-package-${i}`] = "1.0.0";
    }
    const skill = mockSkill(deps);
    const findings = checkDependencies(skill);
    const countFindings = findings.filter((f) => f.id === "DEP-COUNT");
    expect(countFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Undeclared dependency detection (code imports)
// ---------------------------------------------------------------------------
describe("Dependencies: undeclared dependency detection", () => {
  test("detects import of undeclared dependency", () => {
    const skill = mockSkill({ lodash: "4.17.21" }, [
      {
        name: "index.ts",
        code: 'import express from "express";\nimport _ from "lodash";',
      },
    ]);
    const findings = checkDependencies(skill);
    const undeclFindings = findings.filter((f) => f.id.startsWith("DEP-UNDECL"));
    expect(undeclFindings.length).toBeGreaterThanOrEqual(1);
    expect(undeclFindings.some((f) => f.title.includes("express"))).toBe(true);
  });

  test("does not flag node built-in imports as undeclared", () => {
    const skill = mockSkill({}, [
      {
        name: "index.ts",
        code: 'import fs from "fs";\nimport path from "path";\nimport { createServer } from "http";',
      },
    ]);
    const findings = checkDependencies(skill);
    const undeclFindings = findings.filter((f) => f.id.startsWith("DEP-UNDECL"));
    expect(undeclFindings.length).toBe(0);
  });

  test("does not flag declared dependencies as undeclared", () => {
    const skill = mockSkill({ express: "4.18.2", lodash: "4.17.21" }, [
      {
        name: "index.ts",
        code: 'import express from "express";\nimport _ from "lodash";',
      },
    ]);
    const findings = checkDependencies(skill);
    const undeclFindings = findings.filter((f) => f.id.startsWith("DEP-UNDECL"));
    expect(undeclFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Empty / no dependencies
// ---------------------------------------------------------------------------
describe("Dependencies: edge cases", () => {
  test("empty dependencies returns no findings", () => {
    const skill = mockSkill({});
    const findings = checkDependencies(skill);
    expect(findings.length).toBe(0);
  });

  test("no files with only manifest deps returns only manifest-level findings", () => {
    const skill = mockSkill({ "event-stream": "3.3.6" });
    const findings = checkDependencies(skill);
    // Should still detect known vulnerable package from manifest
    const vulnFindings = findings.filter((f) => f.id.startsWith("DEP-VULN"));
    expect(vulnFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Finding structure
// ---------------------------------------------------------------------------
describe("Dependencies: finding structure", () => {
  test("every finding has required fields", () => {
    const skill = mockSkill(
      {
        l0dash: "*",
        "event-stream": "3.3.6",
        request: "^2.88.2",
      },
      [{ name: "index.ts", code: 'import chalk from "chalk";' }],
    );
    const findings = checkDependencies(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    for (const f of findings) {
      expect(f.id).toBeDefined();
      expect(f.rule).toBe("dependencies");
      expect(f.severity).toBeDefined();
      expect(f.category).toBeDefined();
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
    }
  });

  test("findings reference package.json when appropriate", () => {
    const skill = mockSkill({ "event-stream": "3.3.6" });
    const findings = checkDependencies(skill);
    const manifestFindings = findings.filter((f) => f.file === "package.json");
    expect(manifestFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Multiple issues in one skill
// ---------------------------------------------------------------------------
describe("Dependencies: multiple issues in a single skill", () => {
  test("detects typosquat + unpinned version + known vulnerable in same skill", () => {
    const skill = mockSkill({
      l0dash: "*",
      "node-ipc": "latest",
      request: "^2.88.2",
      "safe-lib": "1.0.0",
    });
    const findings = checkDependencies(skill);

    const typoFindings = findings.filter((f) => f.id.startsWith("DEP-TYPO"));
    const vulnFindings = findings.filter((f) => f.id.startsWith("DEP-VULN"));
    const deprFindings = findings.filter((f) => f.id.startsWith("DEP-DEPR"));
    const wildFindings = findings.filter((f) => f.id.startsWith("DEP-WILD"));

    expect(typoFindings.length).toBeGreaterThanOrEqual(1); // l0dash
    expect(vulnFindings.length).toBeGreaterThanOrEqual(1); // node-ipc
    expect(deprFindings.length).toBeGreaterThanOrEqual(1); // request
    expect(wildFindings.length).toBeGreaterThanOrEqual(1); // * and latest
  });
});
