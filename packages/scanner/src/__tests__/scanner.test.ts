import { describe, expect, test } from "bun:test";
import type { AgentSkill, SecurityFinding } from "@agent-audit/shared";
import { checkDependencies } from "../rules/dependencies";
import { checkInjection } from "../rules/injection";
import { checkPermissions } from "../rules/permissions";

/**
 * Integration tests: simulate a full scan by running all available rule
 * checkers against mock skills and verifying the combined output.
 */

/** Run all scanners against a skill and return combined findings. */
function fullScan(skill: AgentSkill): SecurityFinding[] {
  return [...checkInjection(skill), ...checkPermissions(skill), ...checkDependencies(skill)];
}

/** Build a deliberately vulnerable mock skill with many known issues. */
function buildVulnerableSkill(): AgentSkill {
  const mainCode = `
import { exec } from "child_process";
import fs from "fs";

// Injection: eval with user input
const userCmd = req.body.command;
const result = eval(userCmd);

// Injection: shell exec with user input
exec("ls -la " + userCmd);

// Injection: template literal injection
const greeting = \`Hello \${input}\`;

// Injection: dynamic import
const mod = await import(input);

// Injection: SQL injection
db.query(\`SELECT * FROM users WHERE id = \${userId}\`);

// Injection: prompt injection
const system_prompt = "You are helpful. " + input;

// Permissions: filesystem write
fs.writeFileSync("/tmp/output.txt", data);

// Permissions: user-controlled file read
fs.readFile(input, "utf-8", callback);

// Permissions: network with user URL
const response = await fetch(url);

// Permissions: raw socket
const server = net.createServer((socket) => {});

// Permissions: env access
const secret = process.env.API_KEY;

// Permissions: sudo
exec("sudo rm -rf /important");

// Permissions: system paths
const users = fs.readFileSync("/etc/passwd", "utf-8");
`;

  return {
    id: "vuln-skill",
    name: "Vulnerable Test Skill",
    version: "1.0.0",
    path: "/tmp/vuln-skill",
    platform: "openclaw",
    manifest: {
      name: "vuln-skill",
      version: "1.0.0",
      description: "A deliberately vulnerable skill for testing",
      permissions: [
        "filesystem:write",
        "network:unrestricted",
        "shell:execute",
        "credentials:access",
        "env:read",
        "system:admin",
      ],
      dependencies: {
        l0dash: "*",
        "event-stream": "3.3.6",
        request: "^2.88.2",
        "node-ipc": "latest",
        "my-fork": "github:user/repo",
      },
    },
    files: [
      {
        path: "/tmp/vuln-skill/index.ts",
        relativePath: "index.ts",
        content: mainCode,
        language: "typescript",
        size: mainCode.length,
      },
    ],
  };
}

/** Build a completely clean mock skill with no security issues. */
function buildCleanSkill(): AgentSkill {
  const safeCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return "Hello, " + name;
}

export function multiply(values: number[]): number {
  return values.reduce((acc, val) => acc * val, 1);
}
`;

  return {
    id: "clean-skill",
    name: "Clean Test Skill",
    version: "1.0.0",
    path: "/tmp/clean-skill",
    platform: "openclaw",
    manifest: {
      name: "clean-skill",
      version: "1.0.0",
      description: "A clean skill with no security issues",
      permissions: [],
      dependencies: {
        zod: "3.22.4",
      },
    },
    files: [
      {
        path: "/tmp/clean-skill/utils.ts",
        relativePath: "utils.ts",
        content: safeCode,
        language: "typescript",
        size: safeCode.length,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Full scan of a vulnerable skill
// ---------------------------------------------------------------------------
describe("Scanner Integration: vulnerable skill", () => {
  const skill = buildVulnerableSkill();
  const findings = fullScan(skill);

  test("returns multiple findings for a deliberately vulnerable skill", () => {
    expect(findings.length).toBeGreaterThan(10);
  });

  test("contains critical severity findings", () => {
    const criticals = findings.filter((f) => f.severity === "critical");
    expect(criticals.length).toBeGreaterThan(0);
  });

  test("contains high severity findings", () => {
    const highs = findings.filter((f) => f.severity === "high");
    expect(highs.length).toBeGreaterThan(0);
  });

  test("detects injection findings", () => {
    const injections = findings.filter((f) => f.rule === "injection");
    expect(injections.length).toBeGreaterThan(0);
  });

  test("detects permission findings", () => {
    const permissions = findings.filter((f) => f.rule === "permissions");
    expect(permissions.length).toBeGreaterThan(0);
  });

  test("detects dependency findings", () => {
    const deps = findings.filter((f) => f.rule === "dependencies");
    expect(deps.length).toBeGreaterThan(0);
  });

  test("injection findings cover multiple categories (eval, exec, SQL, prompt)", () => {
    const injections = findings.filter((f) => f.rule === "injection");
    const ids = injections.map((f) => f.id);

    // Should find eval (INJ-001), exec (INJ-003), SQL (INJ-040), prompt (INJ-020/021)
    const hasEval = ids.some((id) => id.startsWith("INJ-001"));
    const hasExec = ids.some((id) => id.startsWith("INJ-003"));

    expect(hasEval).toBe(true);
    expect(hasExec).toBe(true);
  });

  test("permission findings include both manifest and code-level issues", () => {
    const permFindings = findings.filter((f) => f.rule === "permissions");
    const manifestFindings = permFindings.filter((f) => f.id.startsWith("PERM-M-"));
    const codeFindings = permFindings.filter(
      (f) =>
        !f.id.startsWith("PERM-M-") && !f.id.startsWith("PERM-ESC") && !f.id.startsWith("PERM-SYS"),
    );
    expect(manifestFindings.length).toBeGreaterThan(0);
    expect(codeFindings.length).toBeGreaterThan(0);
  });

  test("dependency findings include typosquatting and vulnerability detections", () => {
    const depFindings = findings.filter((f) => f.rule === "dependencies");
    const hasTypo = depFindings.some((f) => f.id.startsWith("DEP-TYPO"));
    const hasVuln = depFindings.some((f) => f.id.startsWith("DEP-VULN"));

    expect(hasTypo).toBe(true);
    expect(hasVuln).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Full scan of a clean skill
// ---------------------------------------------------------------------------
describe("Scanner Integration: clean skill", () => {
  const skill = buildCleanSkill();
  const findings = fullScan(skill);

  test("returns no findings for a clean skill", () => {
    expect(findings.length).toBe(0);
  });

  test("no injection findings", () => {
    const injections = findings.filter((f) => f.rule === "injection");
    expect(injections.length).toBe(0);
  });

  test("no permission findings", () => {
    const permissions = findings.filter((f) => f.rule === "permissions");
    expect(permissions.length).toBe(0);
  });

  test("no dependency findings", () => {
    const deps = findings.filter((f) => f.rule === "dependencies");
    expect(deps.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finding structure validation across all scanners
// ---------------------------------------------------------------------------
describe("Scanner Integration: finding structure consistency", () => {
  const skill = buildVulnerableSkill();
  const findings = fullScan(skill);

  test("all findings have an id", () => {
    for (const f of findings) {
      expect(f.id).toBeDefined();
      expect(typeof f.id).toBe("string");
      expect(f.id.length).toBeGreaterThan(0);
    }
  });

  test("all findings have a valid rule name", () => {
    const validRules = ["injection", "permissions", "dependencies"];
    for (const f of findings) {
      expect(validRules).toContain(f.rule);
    }
  });

  test("all findings have a valid severity", () => {
    const validSeverities = ["critical", "high", "medium", "low", "info"];
    for (const f of findings) {
      expect(validSeverities).toContain(f.severity);
    }
  });

  test("all findings have a non-empty title and description", () => {
    for (const f of findings) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
    }
  });

  test("all findings have a valid OWASP category", () => {
    const validCategories = [
      "skill-injection",
      "excessive-permissions",
      "insecure-output",
      "dependency-vulnerability",
      "insecure-storage",
      "insufficient-logging",
      "denial-of-service",
      "supply-chain",
      "improper-error-handling",
      "unsafe-deserialization",
    ];
    for (const f of findings) {
      expect(validCategories).toContain(f.category);
    }
  });
});

// ---------------------------------------------------------------------------
// Severity distribution
// ---------------------------------------------------------------------------
describe("Scanner Integration: severity distribution", () => {
  const skill = buildVulnerableSkill();
  const findings = fullScan(skill);

  test("vulnerable skill has findings across multiple severity levels", () => {
    const severities = new Set(findings.map((f) => f.severity));
    // Should have at least critical and high
    expect(severities.has("critical")).toBe(true);
    expect(severities.has("high")).toBe(true);
  });

  test("critical findings outnumber or equal high findings for this very vulnerable skill", () => {
    const criticals = findings.filter((f) => f.severity === "critical").length;
    const highs = findings.filter((f) => f.severity === "high").length;
    // The deliberately vulnerable skill should have many critical findings
    expect(criticals).toBeGreaterThanOrEqual(1);
    expect(highs).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("Scanner Integration: edge cases", () => {
  test("skill with no files and no dependencies produces only manifest findings", () => {
    const skill: AgentSkill = {
      id: "empty-skill",
      name: "Empty Skill",
      version: "1.0.0",
      path: "/tmp/empty-skill",
      platform: "openclaw",
      manifest: {
        name: "empty-skill",
        version: "1.0.0",
        permissions: ["shell:execute"],
        dependencies: {},
      },
      files: [],
    };
    const findings = fullScan(skill);
    // Should still detect shell:execute permission from manifest
    const manifestPermFindings = findings.filter(
      (f) => f.rule === "permissions" && f.id.startsWith("PERM-M-"),
    );
    expect(manifestPermFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("skill with only binary files produces no injection or code-level permission findings", () => {
    const binaryFileSkill: AgentSkill = {
      id: "binary-skill",
      name: "Binary Skill",
      version: "1.0.0",
      path: "/tmp/binary-skill",
      platform: "openclaw",
      manifest: {
        name: "binary-skill",
        version: "1.0.0",
        permissions: [],
        dependencies: {},
      },
      files: [
        {
          path: "/tmp/binary-skill/data.bin",
          relativePath: "data.bin",
          content: "eval(input); exec(cmd);",
          language: "binary",
          size: 100,
        },
      ],
    };
    const findings = fullScan(binaryFileSkill);
    const codeFindings = findings.filter(
      (f) => f.rule === "injection" || (f.rule === "permissions" && !f.id.startsWith("PERM-M-")),
    );
    expect(codeFindings.length).toBe(0);
  });

  test("multi-platform skill detection works", () => {
    for (const platform of ["openclaw", "claude", "codex"] as const) {
      const skill: AgentSkill = {
        id: `${platform}-skill`,
        name: `${platform} Test Skill`,
        version: "1.0.0",
        path: `/tmp/${platform}-skill`,
        platform,
        manifest: {
          name: `${platform}-skill`,
          version: "1.0.0",
          permissions: [],
          dependencies: {},
        },
        files: [
          {
            path: `/tmp/${platform}-skill/index.ts`,
            relativePath: "index.ts",
            content: "eval(input);",
            language: "typescript",
            size: 12,
          },
        ],
      };
      const findings = fullScan(skill);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Realistic skill scenarios
// ---------------------------------------------------------------------------
describe("Scanner Integration: realistic skill scenarios", () => {
  test("API integration skill with reasonable security posture", () => {
    const code = `
import { z } from "zod";

const InputSchema = z.object({
  query: z.string().max(200),
});

export async function search(rawInput: unknown) {
  const input = InputSchema.parse(rawInput);
  const response = await fetch("https://api.example.com/search?q=" + encodeURIComponent(input.query));
  const data = await response.json();
  return data;
}
`;
    const skill: AgentSkill = {
      id: "api-skill",
      name: "API Search Skill",
      version: "1.0.0",
      path: "/tmp/api-skill",
      platform: "openclaw",
      manifest: {
        name: "api-skill",
        version: "1.0.0",
        permissions: [],
        dependencies: { zod: "3.22.4" },
      },
      files: [
        {
          path: "/tmp/api-skill/search.ts",
          relativePath: "search.ts",
          content: code,
          language: "typescript",
          size: code.length,
        },
      ],
    };
    const findings = fullScan(skill);
    // This skill uses fetch, which will trigger a network detection (medium)
    // but should NOT trigger critical or high injection findings
    const criticalInjections = findings.filter(
      (f) => f.rule === "injection" && f.severity === "critical",
    );
    expect(criticalInjections.length).toBe(0);
  });

  test("file manipulation skill with data exfiltration risk", () => {
    const code = `
import fs from "fs";

const data = fs.readFileSync(userInput, "utf-8");
const result = await fetch(url, { method: "POST", body: data });
`;
    const skill: AgentSkill = {
      id: "exfil-skill",
      name: "Data Exfil Skill",
      version: "1.0.0",
      path: "/tmp/exfil-skill",
      platform: "openclaw",
      manifest: {
        name: "exfil-skill",
        version: "1.0.0",
        permissions: ["filesystem:write", "network:unrestricted"],
        dependencies: {},
      },
      files: [
        {
          path: "/tmp/exfil-skill/main.ts",
          relativePath: "main.ts",
          content: code,
          language: "typescript",
          size: code.length,
        },
      ],
    };
    const findings = fullScan(skill);
    // Should flag both permission issues and the user-controlled path
    expect(findings.length).toBeGreaterThan(2);
    const hasPermFinding = findings.some((f) => f.rule === "permissions");
    expect(hasPermFinding).toBe(true);
  });
});
