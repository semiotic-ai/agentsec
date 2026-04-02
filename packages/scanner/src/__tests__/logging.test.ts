import { describe, expect, test } from "bun:test";
import type { AgentSkill } from "@agent-audit/shared";
import { checkInsufficientLogging } from "../rules/logging";

/**
 * Helper to create a mock AgentSkill with a single code file.
 */
function mockSkill(code: string, filename = "index.ts"): AgentSkill {
  return {
    id: "log-test-skill",
    name: "Logging Test Skill",
    version: "1.0.0",
    path: "/tmp/log-test-skill",
    platform: "openclaw",
    manifest: {
      name: "log-test-skill",
      version: "1.0.0",
      description: "A skill for logging tests",
    },
    files: [
      {
        path: `/tmp/log-test-skill/${filename}`,
        relativePath: filename,
        content: code,
        language: "typescript",
        size: code.length,
      },
    ],
  };
}

/** Helper to create a skill with multiple code files. */
function mockSkillMultiFile(files: { name: string; code: string }[]): AgentSkill {
  return {
    id: "log-multi-skill",
    name: "Logging Multi File Skill",
    version: "1.0.0",
    path: "/tmp/log-multi-skill",
    platform: "openclaw",
    manifest: {
      name: "log-multi-skill",
      version: "1.0.0",
    },
    files: files.map((f) => ({
      path: `/tmp/log-multi-skill/${f.name}`,
      relativePath: f.name,
      content: f.code,
      language: "typescript",
      size: f.code.length,
    })),
  };
}

// ---------------------------------------------------------------------------
// LOG-001: Password logged to console
// ---------------------------------------------------------------------------
describe("Logging: password in logs (LOG-001)", () => {
  test("detects console.log with password", () => {
    const skill = mockSkill(`console.log("password:", password);`);
    const findings = checkInsufficientLogging(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("LOG-001"));
    expect(pwdFindings.length).toBe(1);
    expect(pwdFindings[0].severity).toBe("high");
    expect(pwdFindings[0].title).toBe("Password logged to console");
  });

  test("detects console.error with passwd", () => {
    const skill = mockSkill(`console.error("Failed: passwd is wrong");`);
    const findings = checkInsufficientLogging(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("LOG-001"));
    expect(pwdFindings.length).toBe(1);
  });

  test("detects console.warn with pwd", () => {
    const skill = mockSkill(`console.warn("pwd reset for user", pwd);`);
    const findings = checkInsufficientLogging(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("LOG-001"));
    expect(pwdFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-002: Secret/key logged to console
// ---------------------------------------------------------------------------
describe("Logging: secret in logs (LOG-002)", () => {
  test("detects console.log with secret", () => {
    const skill = mockSkill(`console.log("secret:", secret);`);
    const findings = checkInsufficientLogging(skill);
    const secretFindings = findings.filter((f) => f.id.startsWith("LOG-002"));
    expect(secretFindings.length).toBe(1);
    expect(secretFindings[0].severity).toBe("high");
  });

  test("detects console.info with client_secret", () => {
    const skill = mockSkill(`console.info("client_secret is", client_secret);`);
    const findings = checkInsufficientLogging(skill);
    const secretFindings = findings.filter((f) => f.id.startsWith("LOG-002"));
    expect(secretFindings.length).toBe(1);
  });

  test("detects console.log with secret_key", () => {
    const skill = mockSkill(`console.log("secret_key:", secret_key);`);
    const findings = checkInsufficientLogging(skill);
    const secretFindings = findings.filter((f) => f.id.startsWith("LOG-002"));
    expect(secretFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-003: Authentication token logged
// ---------------------------------------------------------------------------
describe("Logging: token in logs (LOG-003)", () => {
  test("detects console.log with token", () => {
    const skill = mockSkill(`console.log("token:", token);`);
    const findings = checkInsufficientLogging(skill);
    const tokenFindings = findings.filter((f) => f.id.startsWith("LOG-003"));
    expect(tokenFindings.length).toBe(1);
    expect(tokenFindings[0].severity).toBe("high");
  });

  test("detects console.debug with access_token", () => {
    const skill = mockSkill(`console.debug("access_token:", access_token);`);
    const findings = checkInsufficientLogging(skill);
    const tokenFindings = findings.filter((f) => f.id.startsWith("LOG-003"));
    expect(tokenFindings.length).toBe(1);
  });

  test("detects console.log with bearer", () => {
    const skill = mockSkill(`console.log("bearer token", bearer);`);
    const findings = checkInsufficientLogging(skill);
    const tokenFindings = findings.filter((f) => f.id.startsWith("LOG-003"));
    expect(tokenFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-004: API key logged to console
// ---------------------------------------------------------------------------
describe("Logging: API key in logs (LOG-004)", () => {
  test("detects console.log with api_key", () => {
    const skill = mockSkill(`console.log("api_key:", api_key);`);
    const findings = checkInsufficientLogging(skill);
    const apiFindings = findings.filter((f) => f.id.startsWith("LOG-004"));
    expect(apiFindings.length).toBe(1);
    expect(apiFindings[0].severity).toBe("high");
    expect(apiFindings[0].title).toBe("API key logged to console");
  });

  test("detects console.info with apikey", () => {
    const skill = mockSkill(`console.info("apikey is", apikey);`);
    const findings = checkInsufficientLogging(skill);
    const apiFindings = findings.filter((f) => f.id.startsWith("LOG-004"));
    expect(apiFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-005: PII / financial data logged (critical)
// ---------------------------------------------------------------------------
describe("Logging: PII/financial data in logs (LOG-005)", () => {
  test("detects console.log with credit_card", () => {
    const skill = mockSkill(`console.log("credit_card:", credit_card);`);
    const findings = checkInsufficientLogging(skill);
    const piiFindings = findings.filter((f) => f.id.startsWith("LOG-005"));
    expect(piiFindings.length).toBe(1);
    expect(piiFindings[0].severity).toBe("critical");
  });

  test("detects console.log with ssn", () => {
    const skill = mockSkill(`console.log("ssn:", ssn);`);
    const findings = checkInsufficientLogging(skill);
    const piiFindings = findings.filter((f) => f.id.startsWith("LOG-005"));
    expect(piiFindings.length).toBe(1);
    expect(piiFindings[0].severity).toBe("critical");
  });

  test("detects console.error with cvv", () => {
    const skill = mockSkill(`console.error("cvv mismatch:", cvv);`);
    const findings = checkInsufficientLogging(skill);
    const piiFindings = findings.filter((f) => f.id.startsWith("LOG-005"));
    expect(piiFindings.length).toBe(1);
  });

  test("detects console.warn with card_number", () => {
    const skill = mockSkill(`console.warn("card_number validation failed:", card_number);`);
    const findings = checkInsufficientLogging(skill);
    const piiFindings = findings.filter((f) => f.id.startsWith("LOG-005"));
    expect(piiFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-006: Sensitive data in structured logging
// ---------------------------------------------------------------------------
describe("Logging: sensitive data in structured logging (LOG-006)", () => {
  test("detects logger.info with password", () => {
    const skill = mockSkill(`logger.info("User password changed", { password });`);
    const findings = checkInsufficientLogging(skill);
    const structFindings = findings.filter((f) => f.id.startsWith("LOG-006"));
    expect(structFindings.length).toBe(1);
    expect(structFindings[0].severity).toBe("high");
  });

  test("detects logging.debug with token", () => {
    const skill = mockSkill(`logging.debug("token refreshed", token);`);
    const findings = checkInsufficientLogging(skill);
    const structFindings = findings.filter((f) => f.id.startsWith("LOG-006"));
    expect(structFindings.length).toBe(1);
  });

  test("detects log.trace with api_key", () => {
    const skill = mockSkill(`log.trace("api_key used:", api_key);`);
    const findings = checkInsufficientLogging(skill);
    const structFindings = findings.filter((f) => f.id.startsWith("LOG-006"));
    expect(structFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-010: Debug logging left in code
// ---------------------------------------------------------------------------
describe("Logging: debug logging left in code (LOG-010)", () => {
  test("detects console.log with DEBUG prefix", () => {
    const skill = mockSkill(`console.log("DEBUG: user state is", state);`);
    const findings = checkInsufficientLogging(skill);
    const debugFindings = findings.filter((f) => f.id.startsWith("LOG-010"));
    expect(debugFindings.length).toBe(1);
    expect(debugFindings[0].severity).toBe("low");
    expect(debugFindings[0].title).toBe("Debug logging left in code");
  });

  test("detects console.log with VERBOSE prefix", () => {
    const skill = mockSkill(`console.log("VERBOSE: sending request");`);
    const findings = checkInsufficientLogging(skill);
    const debugFindings = findings.filter((f) => f.id.startsWith("LOG-010"));
    expect(debugFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-011: Full request/response logged
// ---------------------------------------------------------------------------
describe("Logging: full request/response logged (LOG-011)", () => {
  test("detects console.log with JSON.stringify(req)", () => {
    const skill = mockSkill(`console.log(JSON.stringify(req));`);
    const findings = checkInsufficientLogging(skill);
    const reqFindings = findings.filter((f) => f.id.startsWith("LOG-011"));
    expect(reqFindings.length).toBe(1);
    expect(reqFindings[0].severity).toBe("medium");
  });

  test("detects console.log with JSON.stringify(response)", () => {
    const skill = mockSkill(`console.log(JSON.stringify(response));`);
    const findings = checkInsufficientLogging(skill);
    const resFindings = findings.filter((f) => f.id.startsWith("LOG-011"));
    expect(resFindings.length).toBe(1);
  });

  test("detects console.log with JSON.stringify(body)", () => {
    const skill = mockSkill(`console.log(JSON.stringify(body));`);
    const findings = checkInsufficientLogging(skill);
    const bodyFindings = findings.filter((f) => f.id.startsWith("LOG-011"));
    expect(bodyFindings.length).toBe(1);
  });

  test("detects console.log with JSON.stringify(headers)", () => {
    const skill = mockSkill(`console.log(JSON.stringify(headers));`);
    const findings = checkInsufficientLogging(skill);
    const hdrFindings = findings.filter((f) => f.id.startsWith("LOG-011"));
    expect(hdrFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-NONE: No logging found in skill
// ---------------------------------------------------------------------------
describe("Logging: no logging found (LOG-NONE)", () => {
  test("flags skill with no logging at all", () => {
    const skill = mockSkill(`
const result = computeValue(42);
export default result;
`);
    const findings = checkInsufficientLogging(skill);
    const noneFindings = findings.filter((f) => f.id === "LOG-NONE");
    expect(noneFindings.length).toBe(1);
    expect(noneFindings[0].severity).toBe("medium");
    expect(noneFindings[0].title).toBe("No logging found in skill");
  });

  test("does not flag LOG-NONE when logging exists", () => {
    const skill = mockSkill(`console.log("initialized");`);
    const findings = checkInsufficientLogging(skill);
    const noneFindings = findings.filter((f) => f.id === "LOG-NONE");
    expect(noneFindings.length).toBe(0);
  });

  test("does not flag LOG-NONE for non-code files only", () => {
    const skill: AgentSkill = {
      id: "no-code-skill",
      name: "No Code Skill",
      version: "1.0.0",
      path: "/tmp/no-code-skill",
      platform: "openclaw",
      manifest: { name: "no-code-skill", version: "1.0.0" },
      files: [
        {
          path: "/tmp/no-code-skill/README.md",
          relativePath: "README.md",
          content: "# No logging here",
          language: "markdown",
          size: 18,
        },
      ],
    };
    const findings = checkInsufficientLogging(skill);
    const noneFindings = findings.filter((f) => f.id === "LOG-NONE");
    expect(noneFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// LOG-NOERR: No error-level logging
// ---------------------------------------------------------------------------
describe("Logging: no error-level logging (LOG-NOERR)", () => {
  test("flags when logging exists but no error-level in 3+ file skill", () => {
    const skill = mockSkillMultiFile([
      { name: "a.ts", code: `console.log("info only");` },
      { name: "b.ts", code: `console.log("more info");` },
      { name: "c.ts", code: `console.log("still info");` },
    ]);
    const findings = checkInsufficientLogging(skill);
    const errFindings = findings.filter((f) => f.id === "LOG-NOERR");
    expect(errFindings.length).toBe(1);
    expect(errFindings[0].severity).toBe("low");
    expect(errFindings[0].title).toBe("No error-level logging found");
  });

  test("does not flag LOG-NOERR when console.error is present", () => {
    const skill = mockSkillMultiFile([
      { name: "a.ts", code: `console.log("info");` },
      { name: "b.ts", code: `console.error("failure");` },
      { name: "c.ts", code: `console.log("more");` },
    ]);
    const findings = checkInsufficientLogging(skill);
    const errFindings = findings.filter((f) => f.id === "LOG-NOERR");
    expect(errFindings.length).toBe(0);
  });

  test("does not flag LOG-NOERR when logger.error is present", () => {
    const skill = mockSkillMultiFile([
      { name: "a.ts", code: `console.log("info");` },
      { name: "b.ts", code: `logger.error("crash");` },
      { name: "c.ts", code: `console.log("more");` },
    ]);
    const findings = checkInsufficientLogging(skill);
    const errFindings = findings.filter((f) => f.id === "LOG-NOERR");
    expect(errFindings.length).toBe(0);
  });

  test("does not flag LOG-NOERR for skill with 2 or fewer files", () => {
    const skill = mockSkillMultiFile([
      { name: "a.ts", code: `console.log("info only");` },
      { name: "b.ts", code: `console.log("more info");` },
    ]);
    const findings = checkInsufficientLogging(skill);
    const errFindings = findings.filter((f) => f.id === "LOG-NOERR");
    expect(errFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// LOG-UNSTRUCTURED: No structured logging library detected
// ---------------------------------------------------------------------------
describe("Logging: unstructured logging warning (LOG-UNSTRUCTURED)", () => {
  test("flags when using console.log without a structured library in 3+ files", () => {
    const skill = mockSkillMultiFile([
      { name: "a.ts", code: `console.log("plain log");` },
      { name: "b.ts", code: `console.error("plain error");` },
      { name: "c.ts", code: `console.log("plain log 2");` },
    ]);
    const findings = checkInsufficientLogging(skill);
    const unstructFindings = findings.filter((f) => f.id === "LOG-UNSTRUCTURED");
    expect(unstructFindings.length).toBe(1);
    expect(unstructFindings[0].severity).toBe("info");
  });

  test("does not flag when pino is used", () => {
    const skill = mockSkillMultiFile([
      {
        name: "a.ts",
        code: `import pino from "pino";\nconsole.log("startup");`,
      },
      { name: "b.ts", code: `console.error("error");` },
      { name: "c.ts", code: `console.log("info");` },
    ]);
    const findings = checkInsufficientLogging(skill);
    const unstructFindings = findings.filter((f) => f.id === "LOG-UNSTRUCTURED");
    expect(unstructFindings.length).toBe(0);
  });

  test("does not flag when winston is used", () => {
    const skill = mockSkillMultiFile([
      {
        name: "a.ts",
        code: `import winston from "winston";\nconsole.log("start");`,
      },
      { name: "b.ts", code: `console.error("error");` },
      { name: "c.ts", code: `console.log("info");` },
    ]);
    const findings = checkInsufficientLogging(skill);
    const unstructFindings = findings.filter((f) => f.id === "LOG-UNSTRUCTURED");
    expect(unstructFindings.length).toBe(0);
  });

  test("does not flag when bunyan is used", () => {
    const skill = mockSkillMultiFile([
      {
        name: "a.ts",
        code: `const log = require("bunyan");\nconsole.log("start");`,
      },
      { name: "b.ts", code: `console.error("err");` },
      { name: "c.ts", code: `console.log("info");` },
    ]);
    const findings = checkInsufficientLogging(skill);
    const unstructFindings = findings.filter((f) => f.id === "LOG-UNSTRUCTURED");
    expect(unstructFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// LOG-AUTH: Authentication without logging
// ---------------------------------------------------------------------------
describe("Logging: security event logging gaps (LOG-AUTH)", () => {
  test("flags auth code without auth logging", () => {
    const skill = mockSkill(`
function authenticate(user, pass) {
  return db.checkCredentials(user, pass);
}
`);
    const findings = checkInsufficientLogging(skill);
    const authFindings = findings.filter((f) => f.id.startsWith("LOG-AUTH"));
    expect(authFindings.length).toBe(1);
    expect(authFindings[0].severity).toBe("medium");
    expect(authFindings[0].title).toBe("Authentication without logging");
  });

  test("does not flag when auth logging is present", () => {
    const skill = mockSkill(`
function authenticate(user, pass) {
  const result = db.checkCredentials(user, pass);
  console.log("auth attempt for", user, result ? "success" : "denied");
  return result;
}
`);
    const findings = checkInsufficientLogging(skill);
    const authFindings = findings.filter((f) => f.id.startsWith("LOG-AUTH"));
    expect(authFindings.length).toBe(0);
  });

  test("flags login function without logging", () => {
    const skill = mockSkill(`
async function login(credentials) {
  return await api.signin(credentials);
}
`);
    const findings = checkInsufficientLogging(skill);
    const authFindings = findings.filter((f) => f.id.startsWith("LOG-AUTH"));
    expect(authFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LOG-AUTHZ: Authorization checks without logging
// ---------------------------------------------------------------------------
describe("Logging: security event logging gaps (LOG-AUTHZ)", () => {
  test("flags authorization code without logging", () => {
    const skill = mockSkill(`
function isAdmin(user) {
  return user.role === "admin";
}
`);
    const findings = checkInsufficientLogging(skill);
    const authzFindings = findings.filter((f) => f.id.startsWith("LOG-AUTHZ"));
    expect(authzFindings.length).toBe(1);
    expect(authzFindings[0].severity).toBe("medium");
    expect(authzFindings[0].title).toBe("Authorization checks without logging");
  });

  test("does not flag when authz logging is present", () => {
    const skill = mockSkill(`
function hasPermission(user, perm) {
  const allowed = user.perms.includes(perm);
  logger.info("permission check", { user: user.id, perm, allowed });
  return allowed;
}
`);
    const findings = checkInsufficientLogging(skill);
    const authzFindings = findings.filter((f) => f.id.startsWith("LOG-AUTHZ"));
    expect(authzFindings.length).toBe(0);
  });

  test("flags checkRole without logging", () => {
    const skill = mockSkill(`
function checkRole(user, role) {
  return user.roles.includes(role);
}
`);
    const findings = checkInsufficientLogging(skill);
    const authzFindings = findings.filter((f) => f.id.startsWith("LOG-AUTHZ"));
    expect(authzFindings.length).toBe(1);
  });

  test("flags canAccess without logging", () => {
    const skill = mockSkill(`
function canAccess(user, resource) {
  return acl.check(user.id, resource);
}
`);
    const findings = checkInsufficientLogging(skill);
    const authzFindings = findings.filter((f) => f.id.startsWith("LOG-AUTHZ"));
    expect(authzFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Comment skipping
// ---------------------------------------------------------------------------
describe("Logging: comment skipping", () => {
  test("skips findings inside single-line comments", () => {
    const skill = mockSkill(`// console.log("password:", password);`);
    const findings = checkInsufficientLogging(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("LOG-001"));
    expect(pwdFindings.length).toBe(0);
  });

  test("skips findings inside block comments", () => {
    const skill = mockSkill(`/* console.log("secret:", secret); */`);
    const findings = checkInsufficientLogging(skill);
    const secretFindings = findings.filter((f) => f.id.startsWith("LOG-002"));
    expect(secretFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Clean code: no false positives
// ---------------------------------------------------------------------------
describe("Logging: clean code produces no findings", () => {
  test("clean skill with proper logging has no sensitive-data findings", () => {
    const skill = mockSkillMultiFile([
      {
        name: "main.ts",
        code: `
import pino from "pino";
const logger = pino();

export function handleRequest(req: Request) {
  logger.info("request received", { method: req.method, url: req.url });
  try {
    const result = process(req);
    logger.info("request completed", { status: 200 });
    return result;
  } catch (err) {
    logger.error("request failed", { error: err.message });
    throw err;
  }
}
`,
      },
      {
        name: "auth.ts",
        code: `
import pino from "pino";
const logger = pino();

export function authenticate(user: string) {
  const ok = verifyUser(user);
  logger.info("auth attempt", { user, access: ok ? "granted" : "denied" });
  return ok;
}
`,
      },
      {
        name: "perms.ts",
        code: `
import pino from "pino";
const logger = pino();

export function hasPermission(userId: string, perm: string) {
  const allowed = checkACL(userId, perm);
  logger.info("permission check", { userId, permission: perm, allowed });
  return allowed;
}
`,
      },
    ]);
    const findings = checkInsufficientLogging(skill);
    // Should have no sensitive data, no missing-logging, or security-event findings
    expect(findings.length).toBe(0);
  });

  test("normal console.log without sensitive data is not flagged", () => {
    const skill = mockSkill(`
console.log("Server started on port", 3000);
console.log("Processing batch", batchId);
console.error("Connection timeout");
`);
    const findings = checkInsufficientLogging(skill);
    const sensitiveFindings = findings.filter(
      (f) =>
        f.id.startsWith("LOG-001") ||
        f.id.startsWith("LOG-002") ||
        f.id.startsWith("LOG-003") ||
        f.id.startsWith("LOG-004") ||
        f.id.startsWith("LOG-005") ||
        f.id.startsWith("LOG-006"),
    );
    expect(sensitiveFindings.length).toBe(0);
  });

  test("non-code files are skipped entirely", () => {
    const skill: AgentSkill = {
      id: "config-skill",
      name: "Config Skill",
      version: "1.0.0",
      path: "/tmp/config-skill",
      platform: "openclaw",
      manifest: { name: "config-skill", version: "1.0.0" },
      files: [
        {
          path: "/tmp/config-skill/config.json",
          relativePath: "config.json",
          content: `{"password": "hunter2"}`,
          language: "json",
          size: 23,
        },
        {
          path: "/tmp/config-skill/style.css",
          relativePath: "style.css",
          content: `body { color: red; }`,
          language: "css",
          size: 20,
        },
      ],
    };
    const findings = checkInsufficientLogging(skill);
    expect(findings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Line number and evidence
// ---------------------------------------------------------------------------
describe("Logging: finding metadata", () => {
  test("reports correct line number", () => {
    const skill = mockSkill(`const x = 1;
const y = 2;
console.log("password:", password);
const z = 3;`);
    const findings = checkInsufficientLogging(skill);
    const pwdFindings = findings.filter((f) => f.id.startsWith("LOG-001"));
    expect(pwdFindings.length).toBe(1);
    expect(pwdFindings[0].line).toBe(3);
  });

  test("reports file path in finding", () => {
    const skill = mockSkill(`console.log("secret:", secret);`, "src/handler.ts");
    const findings = checkInsufficientLogging(skill);
    const secretFindings = findings.filter((f) => f.id.startsWith("LOG-002"));
    expect(secretFindings.length).toBe(1);
    expect(secretFindings[0].file).toBe("src/handler.ts");
  });

  test("evidence is included and redacted", () => {
    const skill = mockSkill(`console.log("api_key:", "sk-abcdefghijklmnopqrstuvwx");`);
    const findings = checkInsufficientLogging(skill);
    const apiFindings = findings.filter((f) => f.id.startsWith("LOG-004"));
    expect(apiFindings.length).toBe(1);
    expect(apiFindings[0].evidence).toBeDefined();
    expect(apiFindings[0].evidence).toContain("[REDACTED]");
  });
});
