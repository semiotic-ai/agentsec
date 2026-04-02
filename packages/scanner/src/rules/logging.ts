import type { AgentSkill, SecurityFinding } from "@agent-audit/shared";

export function checkInsufficientLogging(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  let hasAnyLogging = false;
  let hasErrorLogging = false;
  let hasStructuredLogging = false;
  let totalCodeFiles = 0;

  for (const file of skill.files) {
    if (!["typescript", "javascript", "python"].includes(file.language)) continue;
    totalCodeFiles++;

    // Check for any logging
    if (/console\.(log|warn|error|info|debug)|logger\.|logging\./i.test(file.content)) {
      hasAnyLogging = true;
    }
    if (/console\.error|logger\.error|logging\.error/i.test(file.content)) {
      hasErrorLogging = true;
    }
    if (/logger\.|winston|pino|bunyan|log4/i.test(file.content)) {
      hasStructuredLogging = true;
    }

    // Check for sensitive data in logs
    const sensitiveLogPatterns = [
      /console\.log\s*\([^)]*(?:password|secret|token|key|credential|ssn|credit)/gi,
      /logger\.(?:info|debug|log)\s*\([^)]*(?:password|secret|token|key|credential)/gi,
    ];

    for (const pattern of sensitiveLogPatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(file.content)) !== null) {
        findings.push({
          id: `LOG-001-${findings.length}`,
          rule: "no-sensitive-data-in-logs",
          severity: "high",
          category: "insufficient-logging",
          title: "Sensitive data in log output",
          description: "Log statements may contain sensitive information such as passwords, tokens, or keys.",
          file: file.relativePath,
          line: file.content.substring(0, match.index).split("\n").length,
          evidence: match[0].substring(0, 60),
          remediation: "Redact sensitive data before logging. Use structured logging with data classification.",
        });
      }
    }
  }

  if (totalCodeFiles > 0 && !hasAnyLogging) {
    findings.push({
      id: `LOG-002-${findings.length}`,
      rule: "require-logging",
      severity: "medium",
      category: "insufficient-logging",
      title: "No logging found in skill",
      description: "The skill has no logging statements, making it impossible to audit behavior or diagnose issues.",
      remediation: "Add logging for key operations, errors, and security-relevant events.",
    });
  }

  if (totalCodeFiles > 2 && hasAnyLogging && !hasErrorLogging) {
    findings.push({
      id: `LOG-003-${findings.length}`,
      rule: "require-error-logging",
      severity: "low",
      category: "insufficient-logging",
      title: "No error-level logging",
      description: "The skill has logging but no error-level logs, making failure detection difficult.",
      remediation: "Add error-level logging for exception handlers and failure paths.",
    });
  }

  return findings;
}
