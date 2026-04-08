import type { AgentSkill, SecurityFinding, SkillFile } from "@agent-audit/shared";
import { getEvidenceLine, getLineNumber, isInComment } from "./utils";

/**
 * Rule: Improper Error Handling (AST-09)
 *
 * Checks for error handling patterns that could leak sensitive information,
 * swallow important errors, or leave the system in an inconsistent state.
 */

interface ErrorPattern {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
}

const ERROR_LEAKAGE_PATTERNS: ErrorPattern[] = [
  {
    pattern:
      /res(?:ponse)?\s*\.\s*(?:send|json|write|end)\s*\([^)]*(?:\.stack|\.message|err\b|error\b)/gi,
    id: "ERR-001",
    title: "Error details exposed in HTTP response",
    description:
      "Internal error information (stack traces, messages) is sent to clients. This can reveal file paths, library versions, database schemas, and other sensitive details that aid attackers.",
    severity: "high",
    remediation:
      "Return generic error messages to clients (e.g., 'Internal server error'). Log detailed errors server-side only.",
  },
  {
    pattern: /(?:\.stack|stackTrace|stack_trace)\b/g,
    id: "ERR-002",
    title: "Stack trace access detected",
    description:
      "Stack traces are accessed, which may be sent to untrusted parties. Stack traces reveal internal file structure, library versions, and code paths.",
    severity: "medium",
    remediation:
      "Ensure stack traces are only used for server-side logging. Never include them in client-facing responses or external API calls.",
  },
  {
    pattern:
      /(?:express|app)\s*\.\s*use\s*\([^)]*(?:err|error)[^)]*=>\s*\{[^}]*res\s*\.\s*(?:send|json)\s*\([^)]*(?:err|error|message|stack)/gs,
    id: "ERR-003",
    title: "Express error handler leaks error details",
    description:
      "An Express error middleware forwards error details to the response, potentially exposing sensitive internal information to clients.",
    severity: "high",
    remediation:
      "Return a generic error response in production. Only include error details in development mode.",
  },
];

const EMPTY_CATCH_PATTERNS: ErrorPattern[] = [
  {
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    id: "ERR-010",
    title: "Empty catch block swallows errors",
    description:
      "An empty catch block silently discards errors. This hides bugs, security issues, and makes debugging impossible. Errors that should trigger security alerts are lost.",
    severity: "medium",
    remediation:
      "At minimum, log the error. Better yet, handle it appropriately based on the error type. If intentionally ignoring, add a comment explaining why.",
  },
  {
    pattern: /catch\s*\([^)]*\)\s*\{\s*\/\/\s*(?:ignore|noop|nothing|todo|fixme)\s*\}/gi,
    id: "ERR-011",
    title: "Catch block with only a comment",
    description:
      "A catch block contains only a comment indicating the error is intentionally ignored. While better than an empty catch, this can hide real errors in production.",
    severity: "low",
    remediation:
      "Log ignored errors at debug level so they can be investigated if needed. Consider whether the error truly should be ignored.",
  },
  {
    pattern: /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g,
    id: "ERR-012",
    title: "Promise .catch with empty handler",
    description:
      "A promise catch handler silently swallows rejections. Unhandled promise rejections can cause the process to terminate in newer Node.js versions.",
    severity: "medium",
    remediation:
      "Handle the rejection appropriately or log it. Never silently swallow promise rejections.",
  },
  {
    pattern:
      /\.catch\s*\(\s*(?:\(\s*\)\s*=>\s*(?:null|undefined|void\s+0)|_\s*=>\s*(?:null|undefined|void\s+0))\s*\)/g,
    id: "ERR-013",
    title: "Promise .catch returning null/undefined",
    description:
      "A promise catch handler discards the error and returns null/undefined. This suppresses errors and can lead to hard-to-debug issues.",
    severity: "low",
    remediation: "Log the error before discarding it, or propagate it.",
  },
];

const MISSING_ERROR_HANDLING_PATTERNS: ErrorPattern[] = [
  {
    pattern:
      /process\s*\.\s*on\s*\(\s*["']uncaughtException["']\s*,\s*[^)]*(?:process\.exit|exit)\s*\(/g,
    id: "ERR-020",
    title: "Uncaught exception handler exits without cleanup",
    description:
      "The uncaughtException handler immediately exits without performing cleanup or logging. Resources (file handles, connections) may be left in an inconsistent state.",
    severity: "medium",
    remediation:
      "Log the error, perform graceful cleanup (close connections, flush buffers), then exit.",
  },
  {
    pattern:
      /process\s*\.\s*on\s*\(\s*["']unhandledRejection["']\s*,\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g,
    id: "ERR-021",
    title: "Empty unhandled rejection handler",
    description:
      "The unhandledRejection handler does nothing. Unhandled promise rejections indicate bugs that should be investigated.",
    severity: "medium",
    remediation:
      "Log unhandled rejections and consider exiting gracefully. Unhandled rejections often indicate missing error handling.",
  },
];

const CATCH_ALL_PATTERNS: ErrorPattern[] = [
  {
    pattern:
      /catch\s*\(\s*(?:e|err|error|ex|exception)\s*\)\s*\{[^}]*(?:continue|return\s+(?:null|undefined|false|true|0|""|''))\s*;?\s*\}/gs,
    id: "ERR-030",
    title: "Catch-all with generic return",
    description:
      "A catch block catches all errors and returns a generic value. This masks different error types that may require different handling (validation errors vs. system errors).",
    severity: "low",
    remediation:
      "Catch specific error types and handle each appropriately. Use type guards or error codes to distinguish error types.",
  },
];

const ALL_PATTERNS: ErrorPattern[] = [
  ...ERROR_LEAKAGE_PATTERNS,
  ...EMPTY_CATCH_PATTERNS,
  ...MISSING_ERROR_HANDLING_PATTERNS,
  ...CATCH_ALL_PATTERNS,
];

export function checkErrorHandling(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!isCodeFile(ext)) continue;

    for (const def of ALL_PATTERNS) {
      def.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
      while ((match = def.pattern.exec(file.content)) !== null) {
        if (isInComment(file.content, match.index)) continue;

        counter++;
        findings.push({
          id: `${def.id}-${counter}`,
          rule: "error-handling",
          severity: def.severity,
          category: "improper-error-handling",
          title: def.title,
          description: def.description,
          file: file.relativePath,
          line: getLineNumber(file.content, match.index),
          evidence: getEvidenceLine(file.content, match.index),
          remediation: def.remediation,
        });
      }
    }

    // Additional checks
    checkMissingPromiseCatch(file, findings);
    checkGlobalErrorHandlers(file, findings);
  }

  return findings;
}

function checkMissingPromiseCatch(file: SkillFile, findings: SecurityFinding[]): void {
  const lines = file.content.split("\n");
  let uncaughtCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for .then() without a corresponding .catch()
    if (/\.then\s*\(/.test(line) && !/\.catch\s*\(/.test(line)) {
      // Check the next few lines for a .catch
      const nextLines = lines.slice(i + 1, i + 5).join("\n");
      if (!/\.catch\s*\(/.test(nextLines)) {
        uncaughtCount++;
      }
    }
  }

  if (uncaughtCount > 2) {
    findings.push({
      id: `ERR-PROMISE-${file.relativePath}`,
      rule: "error-handling",
      severity: "medium",
      category: "improper-error-handling",
      title: `${uncaughtCount} promise chains without .catch()`,
      description:
        "Multiple promise chains lack error handling. Unhandled rejections can crash the process or leave the system in an inconsistent state.",
      file: file.relativePath,
      remediation: "Add .catch() to all promise chains or use async/await with try/catch blocks.",
    });
  }
}

function checkGlobalErrorHandlers(file: SkillFile, findings: SecurityFinding[]): void {
  // Check if the file sets up a server but has no global error handler
  const hasServer = /(?:createServer|express\(\)|new\s+(?:Koa|Fastify|Hono))/.test(file.content);
  if (!hasServer) return;

  const hasGlobalErrorHandler =
    /process\.on\s*\(\s*["']uncaughtException/.test(file.content) ||
    /process\.on\s*\(\s*["']unhandledRejection/.test(file.content) ||
    /app\.use\s*\(\s*(?:function\s*\()?\s*(?:err|error)/.test(file.content);

  if (!hasGlobalErrorHandler) {
    findings.push({
      id: `ERR-GLOBAL-${file.relativePath}`,
      rule: "error-handling",
      severity: "low",
      category: "improper-error-handling",
      title: "Server without global error handler",
      description:
        "A server is created without a global error handler. Unhandled errors will use the framework's default error handler, which often exposes internal details in development mode.",
      file: file.relativePath,
      remediation:
        "Add a global error handler middleware (for Express: app.use((err, req, res, next) => {...})). Register process.on('uncaughtException') and process.on('unhandledRejection') handlers.",
    });
  }
}

function isCodeFile(ext: string): boolean {
  return ["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt"].includes(
    ext,
  );
}
