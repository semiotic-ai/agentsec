import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import { getEvidenceLine, getLineNumber, isInComment } from "./utils";

/**
 * Rule: Insufficient Logging and Monitoring (AST-06)
 *
 * Checks for missing or inadequate logging, sensitive data in logs,
 * and lack of security event monitoring in agent skills.
 */

interface LogPattern {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
}

const SENSITIVE_LOG_PATTERNS: LogPattern[] = [
  {
    pattern: /console\s*\.\s*(?:log|info|debug|warn|error)\s*\([^)]*(?:password|passwd|pwd)\b/gi,
    id: "LOG-001",
    title: "Password logged to console",
    description:
      "A password or password-like value is included in console output. Console logs may be captured by monitoring systems, stored in log files, or visible to other processes.",
    severity: "high",
    remediation:
      "Remove password data from log statements. Use a logging library with field redaction.",
  },
  {
    pattern:
      /console\s*\.\s*(?:log|info|debug|warn|error)\s*\([^)]*(?:secret|secret[_-]?key|client[_-]?secret)\b/gi,
    id: "LOG-002",
    title: "Secret/key logged to console",
    description:
      "Secret or key material is included in console output. Secrets in logs can be harvested from log aggregation systems.",
    severity: "high",
    remediation: "Remove secrets from log statements. Redact sensitive fields before logging.",
  },
  {
    pattern:
      /console\s*\.\s*(?:log|info|debug|warn|error)\s*\([^)]*(?:token|auth[_-]?token|access[_-]?token|bearer)\b/gi,
    id: "LOG-003",
    title: "Authentication token logged",
    description:
      "Authentication tokens appear in log output. Leaked tokens allow account takeover.",
    severity: "high",
    remediation:
      "Never log authentication tokens. If correlation is needed, log a hash or truncated version.",
  },
  {
    pattern:
      /console\s*\.\s*(?:log|info|debug|warn|error)\s*\([^)]*(?:api[_-]?key|apikey|api_secret)\b/gi,
    id: "LOG-004",
    title: "API key logged to console",
    description:
      "API keys are included in log output. Exposed API keys can be used to access the associated service.",
    severity: "high",
    remediation:
      "Remove API keys from logs. If needed for debugging, log only the last 4 characters.",
  },
  {
    pattern:
      /console\s*\.\s*(?:log|info|debug|warn|error)\s*\([^)]*(?:credit[_-]?card|card[_-]?number|cvv|ssn|social[_-]?security)\b/gi,
    id: "LOG-005",
    title: "PII/financial data logged",
    description:
      "Personally identifiable information or financial data appears in log output. This may violate data protection regulations (GDPR, PCI-DSS).",
    severity: "critical",
    remediation:
      "Never log PII or financial data. Use data masking and comply with relevant data protection regulations.",
  },
  {
    pattern:
      /(?:logger|log|logging)\s*\.\s*(?:info|debug|log|trace)\s*\([^)]*(?:password|secret|token|key|credential|api[_-]?key)\b/gi,
    id: "LOG-006",
    title: "Sensitive data in structured logging",
    description:
      "Sensitive data is included in structured log output. Even with structured logging, sensitive fields should be redacted.",
    severity: "high",
    remediation:
      "Configure your logging library to auto-redact sensitive fields. Use a field-level redaction list.",
  },
];

const DEBUG_LOG_PATTERNS: LogPattern[] = [
  {
    pattern: /console\s*\.\s*log\s*\(\s*["'](?:DEBUG|debug|VERBOSE|verbose)/g,
    id: "LOG-010",
    title: "Debug logging left in code",
    description:
      "Explicit debug logging statements are present. If left in production, debug logs can expose internal state and degrade performance.",
    severity: "low",
    remediation:
      "Remove debug logging before production deployment. Use a logging library with configurable log levels.",
  },
  {
    pattern:
      /console\s*\.\s*log\s*\(\s*(?:JSON\.stringify\s*\(\s*(?:req|request|res|response|body|headers)\b)/gi,
    id: "LOG-011",
    title: "Full request/response object logged",
    description:
      "Full HTTP request or response objects are serialized and logged. These often contain sensitive headers (Authorization, Cookie), request bodies with credentials, and personal data.",
    severity: "medium",
    remediation:
      "Log only the necessary fields (method, URL, status code). Redact sensitive headers and body fields.",
  },
];

export function checkInsufficientLogging(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  let hasAnyLogging = false;
  let hasErrorLogging = false;
  let hasStructuredLogging = false;
  let totalCodeFiles = 0;

  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!isCodeFile(ext)) continue;
    totalCodeFiles++;

    // Track logging usage
    if (
      /console\s*\.\s*(?:log|warn|error|info|debug)\b|logger\s*\.|logging\s*\./i.test(file.content)
    ) {
      hasAnyLogging = true;
    }
    if (/console\s*\.\s*error|logger\s*\.\s*error|logging\s*\.\s*error/i.test(file.content)) {
      hasErrorLogging = true;
    }
    if (/(?:winston|pino|bunyan|log4js|morgan|signale|consola)\b/.test(file.content)) {
      hasStructuredLogging = true;
    }

    // Check for sensitive data in logs
    const allPatterns = [...SENSITIVE_LOG_PATTERNS, ...DEBUG_LOG_PATTERNS];
    for (const def of allPatterns) {
      def.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
      while ((match = def.pattern.exec(file.content)) !== null) {
        if (isInComment(file.content, match.index)) continue;

        counter++;
        findings.push({
          id: `${def.id}-${file.relativePath}-${counter}`,
          rule: "logging",
          severity: def.severity,
          category: "insufficient-logging",
          title: def.title,
          description: def.description,
          file: file.relativePath,
          line: getLineNumber(file.content, match.index),
          evidence: redactLogEvidence(getEvidenceLine(file.content, match.index)),
          remediation: def.remediation,
        });
      }
    }

    // Check for security-critical operations without logging
    checkSecurityEventLogging(file, findings);
  }

  // Global checks
  if (totalCodeFiles > 0 && !hasAnyLogging) {
    findings.push({
      id: "LOG-NONE",
      rule: "logging",
      severity: "medium",
      category: "insufficient-logging",
      title: "No logging found in skill",
      description:
        "The skill has no logging statements across any files. Without logging, it is impossible to audit the skill's behavior, detect anomalies, or investigate security incidents.",
      remediation:
        "Add logging for key operations: authentication, authorization decisions, data access, errors, and configuration changes. Use a structured logging library.",
    });
  }

  if (totalCodeFiles > 2 && hasAnyLogging && !hasErrorLogging) {
    findings.push({
      id: "LOG-NOERR",
      rule: "logging",
      severity: "low",
      category: "insufficient-logging",
      title: "No error-level logging found",
      description:
        "The skill has general logging but no error-level log statements. Errors may go unnoticed, delaying incident detection and response.",
      remediation:
        "Add error-level logging for all catch blocks, failure conditions, and unexpected states.",
    });
  }

  if (totalCodeFiles > 2 && hasAnyLogging && !hasStructuredLogging) {
    findings.push({
      id: "LOG-UNSTRUCTURED",
      rule: "logging",
      severity: "info",
      category: "insufficient-logging",
      title: "No structured logging library detected",
      description:
        "The skill uses console.log instead of a structured logging library. Structured logging enables better search, filtering, and automated analysis of log data.",
      remediation:
        "Consider using a structured logging library (pino, winston, bunyan) for machine-parseable log output with log levels, timestamps, and context.",
    });
  }

  return findings;
}

function checkSecurityEventLogging(file: SkillFile, findings: SecurityFinding[]): void {
  // Check if the file has authentication but no auth logging
  const hasAuth = /(?:authenticate|login|signin|authorize|verifyToken|checkAuth)\b/i.test(
    file.content,
  );
  if (hasAuth) {
    const hasAuthLogging =
      /(?:console|logger|log)\s*\.\s*\w+\s*\([^)]*(?:auth|login|access|denied|unauthorized|forbidden)/i.test(
        file.content,
      );
    if (!hasAuthLogging) {
      findings.push({
        id: `LOG-AUTH-${file.relativePath}`,
        rule: "logging",
        severity: "medium",
        category: "insufficient-logging",
        title: "Authentication without logging",
        description:
          "The file contains authentication logic but no logging of authentication events. Failed and successful logins should always be logged for security monitoring.",
        file: file.relativePath,
        remediation:
          "Log all authentication events: successful logins, failed attempts (with username but without password), and session creation/destruction.",
      });
    }
  }

  // Check if the file has authorization checks but no audit logging
  const hasAuthz = /(?:isAdmin|isAuthorized|hasPermission|checkRole|canAccess|rbac)\b/i.test(
    file.content,
  );
  if (hasAuthz) {
    const hasAuthzLogging =
      /(?:console|logger|log)\s*\.\s*\w+\s*\([^)]*(?:permission|role|access|denied|forbidden|authorized)/i.test(
        file.content,
      );
    if (!hasAuthzLogging) {
      findings.push({
        id: `LOG-AUTHZ-${file.relativePath}`,
        rule: "logging",
        severity: "medium",
        category: "insufficient-logging",
        title: "Authorization checks without logging",
        description:
          "The file contains authorization logic but no logging of authorization decisions. Access denials should be logged for security monitoring.",
        file: file.relativePath,
        remediation:
          "Log all authorization decisions, especially denials. Include the user, requested resource, and decision.",
      });
    }
  }
}

function redactLogEvidence(evidence: string): string {
  // Redact any actual credential values that might appear in the evidence
  return evidence.replace(/(["'])[a-zA-Z0-9_\-/+=]{20,}(\1)/g, "$1[REDACTED]$2");
}

function isCodeFile(ext: string): boolean {
  return ["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt"].includes(
    ext,
  );
}
