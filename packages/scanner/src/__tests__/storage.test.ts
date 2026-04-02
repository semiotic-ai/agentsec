import { describe, test, expect } from "bun:test";
import { checkStorage } from "../rules/storage";
import type { AgentSkill } from "@agent-audit/shared";

/**
 * Helper to create a mock AgentSkill with a single file containing
 * the provided code content.
 */
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

/** A complete .gitignore that passes the checkGitignoreForSecrets check. */
const COMPLETE_GITIGNORE = ".env\n*.pem\n*.key\ncredentials";

/** Helper to create a skill with multiple files. */
function mockSkillMultiFile(files: { name: string; code: string }[]): AgentSkill {
  return {
    id: "multi-skill",
    name: "Multi File Skill",
    version: "1.0.0",
    path: "/tmp/multi-skill",
    platform: "openclaw",
    manifest: {
      name: "multi-skill",
      version: "1.0.0",
    },
    files: files.map((f) => ({
      path: `/tmp/multi-skill/${f.name}`,
      relativePath: f.name,
      content: f.code,
      language: "typescript",
      size: f.code.length,
    })),
  };
}

// ---------------------------------------------------------------------------
// Hardcoded API keys and secrets
// ---------------------------------------------------------------------------
describe("Storage: hardcoded API key detection", () => {
  test("detects hardcoded api_key assignment", () => {
    const skill = mockSkill(`
const api_key = "abcdef1234567890abcdef";
`);
    const findings = checkStorage(skill);
    const keyFindings = findings.filter((f) => f.id.startsWith("STOR-001"));
    expect(keyFindings.length).toBeGreaterThanOrEqual(1);
    expect(keyFindings[0].severity).toBe("critical");
    expect(keyFindings[0].rule).toBe("storage");
    expect(keyFindings[0].category).toBe("insecure-storage");
  });

  test("detects apiKey camelCase assignment", () => {
    const skill = mockSkill(`
const apiKey = "abcdef1234567890abcdef";
`);
    const findings = checkStorage(skill);
    const keyFindings = findings.filter((f) => f.id.startsWith("STOR-001"));
    expect(keyFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects hardcoded secret_key", () => {
    const skill = mockSkill(`
const secret_key = "mysecretvalue1234";
`);
    const findings = checkStorage(skill);
    const secretFindings = findings.filter((f) => f.id.startsWith("STOR-002"));
    expect(secretFindings.length).toBeGreaterThanOrEqual(1);
    expect(secretFindings[0].severity).toBe("critical");
  });

  test("detects hardcoded client_secret", () => {
    const skill = mockSkill(`
const client_secret = "clientsecretabcd";
`);
    const findings = checkStorage(skill);
    const secretFindings = findings.filter((f) => f.id.startsWith("STOR-002"));
    expect(secretFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects hardcoded password", () => {
    const skill = mockSkill(`
const password = "hunter2abc";
`);
    const findings = checkStorage(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("STOR-003"));
    expect(pwdFindings.length).toBeGreaterThanOrEqual(1);
    expect(pwdFindings[0].severity).toBe("critical");
  });

  test("detects hardcoded token", () => {
    const skill = mockSkill(`
const auth_token = "a1b2c3d4e5f6g7h8i9j0klmnopqrstuv";
`);
    const findings = checkStorage(skill);
    const tokenFindings = findings.filter((f) => f.id.startsWith("STOR-004"));
    expect(tokenFindings.length).toBeGreaterThanOrEqual(1);
    expect(tokenFindings[0].severity).toBe("critical");
  });

  test("detects hardcoded private key PEM header", () => {
    const skill = mockSkill(`
const key = "-----BEGIN RSA PRIVATE KEY-----\\nMIIE...";
`);
    const findings = checkStorage(skill);
    const pkFindings = findings.filter(
      (f) => f.id.startsWith("STOR-005") || f.id.startsWith("STOR-006")
    );
    expect(pkFindings.length).toBeGreaterThanOrEqual(1);
    expect(pkFindings[0].severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// AWS access key detection
// ---------------------------------------------------------------------------
describe("Storage: AWS credential detection", () => {
  test("detects AWS access key ID (AKIA pattern)", () => {
    const skill = mockSkill(`
const awsKey = "AKIA4RJPLNCZV8GNQUD2";
`);
    const findings = checkStorage(skill);
    const awsFindings = findings.filter((f) => f.id.startsWith("STOR-008"));
    expect(awsFindings.length).toBeGreaterThanOrEqual(1);
    expect(awsFindings[0].severity).toBe("critical");
    expect(awsFindings[0].title).toContain("AWS");
  });

  test("detects aws_access_key_id assignment", () => {
    const skill = mockSkill(`
const aws_access_key_id = "AKIA4RJPLNCZV8GNQUD2";
`);
    const findings = checkStorage(skill);
    const awsFindings = findings.filter(
      (f) => f.id.startsWith("STOR-007") || f.id.startsWith("STOR-008")
    );
    expect(awsFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag non-AKIA strings", () => {
    const skill = mockSkill(`
const normalVar = "ABCDIOSFODNN7EXAMPLE";
`);
    const findings = checkStorage(skill);
    const awsFindings = findings.filter((f) => f.id.startsWith("STOR-008"));
    expect(awsFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GitHub PAT detection
// ---------------------------------------------------------------------------
describe("Storage: GitHub token detection", () => {
  test("detects GitHub personal access token (ghp_ pattern)", () => {
    const skill = mockSkill(`
const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
`);
    const findings = checkStorage(skill);
    const ghFindings = findings.filter((f) => f.id.startsWith("STOR-009"));
    expect(ghFindings.length).toBeGreaterThanOrEqual(1);
    expect(ghFindings[0].severity).toBe("critical");
    expect(ghFindings[0].title).toContain("GitHub");
  });

  test("detects GitHub OAuth token (gho_ pattern)", () => {
    const skill = mockSkill(`
const token = "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
`);
    const findings = checkStorage(skill);
    const ghFindings = findings.filter((f) => f.id.startsWith("STOR-009"));
    expect(ghFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects github_pat_ token format", () => {
    const skill = mockSkill(`
const token = "github_pat_ABCDEFGHIJKLMNOPQRSTUV";
`);
    const findings = checkStorage(skill);
    const ghFindings = findings.filter((f) => f.id.startsWith("STOR-009"));
    expect(ghFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Slack token detection
// ---------------------------------------------------------------------------
describe("Storage: Slack token detection", () => {
  test("detects Slack bot token (xoxb- pattern)", () => {
    const skill = mockSkill(`
const slackToken = "xoxb-1234567890-abcdefghij";
`);
    const findings = checkStorage(skill);
    const slackFindings = findings.filter((f) => f.id.startsWith("STOR-011"));
    expect(slackFindings.length).toBeGreaterThanOrEqual(1);
    expect(slackFindings[0].severity).toBe("critical");
    expect(slackFindings[0].title).toContain("Slack");
  });

  test("detects Slack user token (xoxp- pattern)", () => {
    const skill = mockSkill(`
const slackToken = "xoxp-1234567890-abcdefghij";
`);
    const findings = checkStorage(skill);
    const slackFindings = findings.filter((f) => f.id.startsWith("STOR-011"));
    expect(slackFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects Slack app token (xoxa- pattern)", () => {
    const skill = mockSkill(`
const slackToken = "xoxa-1234567890-abcdefghij";
`);
    const findings = checkStorage(skill);
    const slackFindings = findings.filter((f) => f.id.startsWith("STOR-011"));
    expect(slackFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// OpenAI / Stripe key detection (sk- pattern)
// ---------------------------------------------------------------------------
describe("Storage: OpenAI/Stripe key detection", () => {
  test("detects OpenAI API key (sk- pattern)", () => {
    const skill = mockSkill(`
const openaiKey = "sk-abcdefghijklmnopqrstuvwxyz1234567890";
`);
    const findings = checkStorage(skill);
    const skFindings = findings.filter((f) => f.id.startsWith("STOR-010"));
    expect(skFindings.length).toBeGreaterThanOrEqual(1);
    expect(skFindings[0].severity).toBe("critical");
    expect(skFindings[0].title).toContain("OpenAI");
  });

  test("does not flag short sk- strings that are not keys", () => {
    const skill = mockSkill(`
const shortVal = "sk-abc";
`);
    const findings = checkStorage(skill);
    const skFindings = findings.filter((f) => f.id.startsWith("STOR-010"));
    expect(skFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Insecure storage patterns
// ---------------------------------------------------------------------------
describe("Storage: insecure storage patterns", () => {
  test("detects localStorage.setItem with token", () => {
    const skill = mockSkill(`
localStorage.setItem("token", authToken);
`);
    const findings = checkStorage(skill);
    const lsFindings = findings.filter((f) => f.id.startsWith("STOR-020"));
    expect(lsFindings.length).toBeGreaterThanOrEqual(1);
    expect(lsFindings[0].severity).toBe("high");
    expect(lsFindings[0].title).toContain("localStorage");
  });

  test("detects localStorage.setItem with secret", () => {
    const skill = mockSkill(`
localStorage.setItem("secret", secretValue);
`);
    const findings = checkStorage(skill);
    const lsFindings = findings.filter((f) => f.id.startsWith("STOR-020"));
    expect(lsFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects sessionStorage.setItem with password", () => {
    const skill = mockSkill(`
sessionStorage.setItem("password", pwd);
`);
    const findings = checkStorage(skill);
    const ssFindings = findings.filter((f) => f.id.startsWith("STOR-021"));
    expect(ssFindings.length).toBeGreaterThanOrEqual(1);
    expect(ssFindings[0].severity).toBe("medium");
  });

  test("detects writeFileSync with credential file", () => {
    const skill = mockSkill(`
fs.writeFileSync("credentials.json", JSON.stringify(data));
`);
    const findings = checkStorage(skill);
    const writeFindings = findings.filter((f) => f.id.startsWith("STOR-023"));
    expect(writeFindings.length).toBeGreaterThanOrEqual(1);
    expect(writeFindings[0].severity).toBe("high");
  });

  test("detects writeFileSync writing to .env file", () => {
    const skill = mockSkill(`
fs.writeFileSync(".env", envContent);
`);
    const findings = checkStorage(skill);
    const writeFindings = findings.filter((f) => f.id.startsWith("STOR-023"));
    expect(writeFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects console.log with password", () => {
    const skill = mockSkill(`
console.log("User password:", password);
`);
    const findings = checkStorage(skill);
    const logFindings = findings.filter((f) => f.id.startsWith("STOR-024"));
    expect(logFindings.length).toBeGreaterThanOrEqual(1);
    expect(logFindings[0].severity).toBe("high");
  });

  test("detects console.log with api_key", () => {
    const skill = mockSkill(`
console.log("api_key is", key);
`);
    const findings = checkStorage(skill);
    const logFindings = findings.filter((f) => f.id.startsWith("STOR-024"));
    expect(logFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag localStorage with non-sensitive key", () => {
    const skill = mockSkill(`
localStorage.setItem("theme", "dark");
`);
    const findings = checkStorage(skill);
    const lsFindings = findings.filter((f) => f.id.startsWith("STOR-020"));
    expect(lsFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Weak crypto detection
// ---------------------------------------------------------------------------
describe("Storage: weak crypto detection", () => {
  test("detects MD5 hash usage", () => {
    const skill = mockSkill(`
const hash = crypto.createHash("md5").update(data).digest("hex");
`);
    const findings = checkStorage(skill);
    const hashFindings = findings.filter((f) => f.id.startsWith("STOR-030"));
    expect(hashFindings.length).toBeGreaterThanOrEqual(1);
    expect(hashFindings[0].severity).toBe("high");
    expect(hashFindings[0].title).toContain("Weak hash");
  });

  test("detects SHA1 hash usage", () => {
    const skill = mockSkill(`
const hash = crypto.createHash("sha1").update(data).digest("hex");
`);
    const findings = checkStorage(skill);
    const hashFindings = findings.filter((f) => f.id.startsWith("STOR-030"));
    expect(hashFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects weak encryption algorithm (DES)", () => {
    const skill = mockSkill(`
const cipher = crypto.createCipher("des", key);
`);
    const findings = checkStorage(skill);
    const cipherFindings = findings.filter((f) => f.id.startsWith("STOR-031"));
    expect(cipherFindings.length).toBeGreaterThanOrEqual(1);
    expect(cipherFindings[0].severity).toBe("high");
  });

  test("detects weak encryption algorithm (RC4)", () => {
    const skill = mockSkill(`
const cipher = crypto.createCipher("rc4", key);
`);
    const findings = checkStorage(skill);
    const cipherFindings = findings.filter((f) => f.id.startsWith("STOR-031"));
    expect(cipherFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects deprecated createCipher usage", () => {
    const skill = mockSkill(`
const cipher = crypto.createCipher("aes-256-cbc", key);
`);
    const findings = checkStorage(skill);
    const deprecatedFindings = findings.filter((f) => f.id.startsWith("STOR-032"));
    expect(deprecatedFindings.length).toBeGreaterThanOrEqual(1);
    expect(deprecatedFindings[0].severity).toBe("medium");
  });

  test("detects base64 encoding of credentials", () => {
    const skill = mockSkill(`
const encoded = btoa(password);
`);
    const findings = checkStorage(skill);
    const b64Findings = findings.filter((f) => f.id.startsWith("STOR-033"));
    expect(b64Findings.length).toBeGreaterThanOrEqual(1);
    expect(b64Findings[0].severity).toBe("high");
  });

  test("does not flag SHA-256 as weak", () => {
    const skill = mockSkill(`
const hash = crypto.createHash("sha256").update(data).digest("hex");
`);
    const findings = checkStorage(skill);
    const hashFindings = findings.filter((f) => f.id.startsWith("STOR-030"));
    expect(hashFindings.length).toBe(0);
  });

  test("does not flag createCipheriv (the modern API)", () => {
    const skill = mockSkill(`
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
`);
    const findings = checkStorage(skill);
    const cipherFindings = findings.filter((f) => f.id.startsWith("STOR-032"));
    expect(cipherFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// .gitignore completeness checks
// ---------------------------------------------------------------------------
describe("Storage: .gitignore completeness", () => {
  test("reports missing .gitignore file", () => {
    const skill = mockSkill(`
const x = 42;
`);
    const findings = checkStorage(skill);
    const gitFindings = findings.filter((f) => f.id === "STOR-GIT-MISSING");
    expect(gitFindings.length).toBe(1);
    expect(gitFindings[0].severity).toBe("medium");
  });

  test("reports incomplete .gitignore missing .env", () => {
    const skill = mockSkillMultiFile([
      { name: "index.ts", code: "const x = 1;" },
      { name: ".gitignore", code: "node_modules/\n*.pem\n*.key\ncredentials" },
    ]);
    const findings = checkStorage(skill);
    const gitFindings = findings.filter((f) => f.id === "STOR-GIT-INCOMPLETE");
    expect(gitFindings.length).toBe(1);
    expect(gitFindings[0].evidence).toContain(".env");
  });

  test("reports incomplete .gitignore missing *.pem and *.key", () => {
    const skill = mockSkillMultiFile([
      { name: "index.ts", code: "const x = 1;" },
      { name: ".gitignore", code: "node_modules/\n.env\ncredentials" },
    ]);
    const findings = checkStorage(skill);
    const gitFindings = findings.filter((f) => f.id === "STOR-GIT-INCOMPLETE");
    expect(gitFindings.length).toBe(1);
    expect(gitFindings[0].evidence).toContain("*.pem");
    expect(gitFindings[0].evidence).toContain("*.key");
  });

  test("passes with complete .gitignore", () => {
    const skill = mockSkillMultiFile([
      { name: "index.ts", code: "const x = 1;" },
      { name: ".gitignore", code: `node_modules/\n${COMPLETE_GITIGNORE}\ndist/` },
    ]);
    const findings = checkStorage(skill);
    const gitFindings = findings.filter(
      (f) => f.id === "STOR-GIT-MISSING" || f.id === "STOR-GIT-INCOMPLETE"
    );
    expect(gitFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// .env file reference detection
// ---------------------------------------------------------------------------
describe("Storage: .env file references", () => {
  test("detects dotenv config usage", () => {
    const skill = mockSkillMultiFile([
      { name: "index.ts", code: 'dotenv.config(".env");' },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    const envFindings = findings.filter((f) => f.id.startsWith("STOR-ENV"));
    expect(envFindings.length).toBeGreaterThanOrEqual(1);
    expect(envFindings[0].severity).toBe("info");
  });

  test("detects readFileSync of .env", () => {
    const skill = mockSkillMultiFile([
      { name: "index.ts", code: 'fs.readFileSync(".env", "utf8");' },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    const envFindings = findings.filter((f) => f.id.startsWith("STOR-ENV"));
    expect(envFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Clean code - no false positives
// ---------------------------------------------------------------------------
describe("Storage: clean code produces no findings", () => {
  test("safe code with environment variable usage", () => {
    const skill = mockSkillMultiFile([
      {
        name: "index.ts",
        code: `
const apiKey = process.env.API_KEY;
const hash = crypto.createHash("sha256").update(data).digest("hex");
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
`,
      },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    // Should only have non-critical or no findings
    const criticalFindings = findings.filter((f) => f.severity === "critical");
    expect(criticalFindings.length).toBe(0);
  });

  test("clean utility code with no secrets", () => {
    const skill = mockSkillMultiFile([
      {
        name: "utils.ts",
        code: `
export function add(a: number, b: number): number {
  return a + b;
}

export function formatDate(date: Date): string {
  return date.toISOString();
}
`,
      },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    const criticalOrHigh = findings.filter(
      (f) => f.severity === "critical" || f.severity === "high"
    );
    expect(criticalOrHigh.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Comment and example value filtering
// ---------------------------------------------------------------------------
describe("Storage: comment and example filtering", () => {
  test("ignores secrets in single-line comments", () => {
    const skill = mockSkillMultiFile([
      {
        name: "index.ts",
        code: `
// api_key = "abcdef1234567890abcdef"
const x = 42;
`,
      },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    const keyFindings = findings.filter((f) => f.id.startsWith("STOR-001"));
    expect(keyFindings.length).toBe(0);
  });

  test("ignores secrets in block comments", () => {
    const skill = mockSkillMultiFile([
      {
        name: "index.ts",
        code: `
/*
  api_key = "abcdef1234567890abcdef"
*/
const safe = 42;
`,
      },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    const keyFindings = findings.filter((f) => f.id.startsWith("STOR-001"));
    expect(keyFindings.length).toBe(0);
  });

  test("ignores placeholder/example values", () => {
    const skill = mockSkillMultiFile([
      {
        name: "config.ts",
        code: `
const api_key = "your_api_key_placeholder_here";
`,
      },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    const keyFindings = findings.filter((f) => f.id.startsWith("STOR-001"));
    expect(keyFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test file filtering
// ---------------------------------------------------------------------------
describe("Storage: test file filtering", () => {
  test("skips hardcoded secret patterns in test files", () => {
    const skill = mockSkillMultiFile([
      {
        name: "auth.test.ts",
        code: `
const api_key = "abcdef1234567890abcdef";
const password = "testpassword123";
`,
      },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    // STOR-00x findings should be skipped for test files
    const secretFindings = findings.filter((f) => /^STOR-00\d/.test(f.id));
    expect(secretFindings.length).toBe(0);
  });

  test("still detects insecure storage patterns in test files", () => {
    const skill = mockSkillMultiFile([
      {
        name: "storage.test.ts",
        code: `
const hash = crypto.createHash("md5").update(data).digest("hex");
`,
      },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    const hashFindings = findings.filter((f) => f.id.startsWith("STOR-030"));
    expect(hashFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// File type filtering
// ---------------------------------------------------------------------------
describe("Storage: file type filtering", () => {
  test("scans .ts files", () => {
    const skill = mockSkill('const password = "hunter2abc";', "handler.ts");
    const findings = checkStorage(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("STOR-003"));
    expect(pwdFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("scans .js files", () => {
    const skill = mockSkill('const password = "hunter2abc";', "handler.js");
    const findings = checkStorage(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("STOR-003"));
    expect(pwdFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("scans .py files", () => {
    const skill = mockSkill('password = "hunter2abc"', "handler.py");
    const findings = checkStorage(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("STOR-003"));
    expect(pwdFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("scans .yaml files", () => {
    const skill = mockSkill('password: "hunter2abc"', "config.yaml");
    const findings = checkStorage(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("STOR-003"));
    expect(pwdFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not scan .png files", () => {
    const skill = mockSkill('const password = "hunter2abc";', "image.png");
    const findings = checkStorage(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("STOR-003"));
    expect(pwdFindings.length).toBe(0);
  });

  test("does not scan .wasm files", () => {
    const skill = mockSkill('const password = "hunter2abc";', "module.wasm");
    const findings = checkStorage(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("STOR-003"));
    expect(pwdFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple files
// ---------------------------------------------------------------------------
describe("Storage: multiple file scanning", () => {
  test("reports findings from all files in a skill", () => {
    const skill = mockSkillMultiFile([
      { name: "a.ts", code: 'const password = "hunter2abc";' },
      { name: "b.ts", code: 'const api_key = "abcdef1234567890abcdef";' },
      { name: ".gitignore", code: COMPLETE_GITIGNORE },
    ]);
    const findings = checkStorage(skill);
    const filesWithFindings = new Set(findings.map((f) => f.file));
    expect(filesWithFindings.has("a.ts")).toBe(true);
    expect(filesWithFindings.has("b.ts")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Finding structure validation
// ---------------------------------------------------------------------------
describe("Storage: finding structure", () => {
  test("every finding has required fields", () => {
    const skill = mockSkill(`
const api_key = "abcdef1234567890abcdef";
const password = "hunter2abc";
const hash = crypto.createHash("md5").update(data).digest("hex");
`);
    const findings = checkStorage(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    for (const f of findings) {
      expect(f.id).toBeDefined();
      expect(f.rule).toBe("storage");
      expect(f.severity).toBeDefined();
      expect(f.category).toBe("insecure-storage");
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(f.remediation).toBeDefined();
    }
  });

  test("findings have unique ids", () => {
    const skill = mockSkill(`
const api_key = "abcdef1234567890abcdef";
const password = "hunter2abc";
const secret = "mysecretvalue1234";
`);
    const findings = checkStorage(skill);
    const ids = findings.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test("evidence is redacted for hardcoded secrets", () => {
    const skill = mockSkill(`
const api_key = "abcdef1234567890abcdef";
`);
    const findings = checkStorage(skill);
    const keyFindings = findings.filter((f) => f.id.startsWith("STOR-001"));
    expect(keyFindings.length).toBeGreaterThanOrEqual(1);
    // Evidence should contain [REDACTED] instead of the actual secret
    expect(keyFindings[0].evidence).toContain("[REDACTED]");
  });

  test("line numbers are reported correctly", () => {
    const skill = mockSkill(`const a = 1;
const b = 2;
const password = "hunter2abc";
`);
    const findings = checkStorage(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("STOR-003"));
    expect(pwdFindings.length).toBeGreaterThanOrEqual(1);
    expect(pwdFindings[0].file).toBe("index.ts");
    expect(pwdFindings[0].line).toBe(3);
  });
});
