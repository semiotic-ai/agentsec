import type { AgentSkill, SecurityFinding, SkillFile } from "@agent-audit/shared";
import { DANGEROUS_PERMISSIONS } from "@agent-audit/shared";
import { getEvidenceLine, getLineNumber, isCodeFile, isInComment } from "./utils";

/**
 * Rule: Excessive Permissions (AST-02)
 *
 * Checks for overly broad or dangerous permission requests in skill
 * manifests and code, including filesystem, network, shell, and
 * credential access patterns.
 */

interface PermissionPattern {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
}

const CODE_PERMISSION_PATTERNS: PermissionPattern[] = [
  {
    pattern:
      /fs\s*\.\s*(?:writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync|rename|renameSync|chmod|chmodSync|chown|chownSync)\s*\(/g,
    id: "PERM-010",
    title: "Filesystem write operation detected",
    description:
      "The skill performs filesystem write operations that could modify or delete files on the host system. Without proper path validation, this enables path traversal attacks.",
    severity: "high",
    remediation:
      "Restrict filesystem operations to a sandboxed directory. Validate all paths against an allowlist and resolve symlinks before access.",
  },
  {
    pattern:
      /fs\s*\.\s*(?:readFile|readFileSync|readdir|readdirSync|stat|statSync|access|accessSync|createReadStream)\s*\(\s*(?:user|input|query|req|data|param|arg|body|path)\b/gi,
    id: "PERM-011",
    title: "Filesystem read with user-controlled path",
    description:
      "Filesystem read operations use user-controlled input for the file path. This enables reading arbitrary files from the system (path traversal).",
    severity: "critical",
    remediation:
      "Validate and sanitize file paths. Use path.resolve() and verify the resolved path is within the allowed directory. Block '..' sequences.",
  },
  {
    pattern:
      /(?:fetch|axios|got|request|http\.(?:get|post|put|patch|delete|request)|https\.(?:get|post|put|patch|delete|request))\s*\(/g,
    id: "PERM-020",
    title: "Network request detected",
    description:
      "The skill makes outbound network requests. Without URL validation, this could enable SSRF (Server-Side Request Forgery) or data exfiltration.",
    severity: "medium",
    remediation:
      "Validate outbound URLs against an allowlist of permitted domains. Block requests to internal/private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x).",
  },
  {
    pattern:
      /(?:fetch|axios|got|request|http\.(?:get|post)|https\.(?:get|post))\s*\(\s*(?:user|input|query|req|data|param|arg|body|url)\b/gi,
    id: "PERM-021",
    title: "Network request with user-controlled URL",
    description:
      "Outbound network requests use a user-controlled URL. This is a Server-Side Request Forgery (SSRF) vulnerability that can access internal services.",
    severity: "critical",
    remediation:
      "Validate URLs against a strict domain allowlist. Resolve DNS and block private IP ranges. Never pass user input directly as a URL.",
  },
  {
    pattern: /process\s*\.\s*env/g,
    id: "PERM-030",
    title: "Environment variable access",
    description:
      "The skill reads environment variables, which often contain secrets, API keys, and configuration data. Excessive env access increases the blast radius of a compromise.",
    severity: "low",
    remediation:
      "Only access specifically needed environment variables. Document which env vars are required and why.",
  },
  {
    pattern: /process\s*\.\s*env\s*\[\s*(?:user|input|query|req|data|param|arg|body)\b/gi,
    id: "PERM-031",
    title: "Dynamic environment variable access with user input",
    description:
      "Environment variables are accessed using a user-controlled key. This can leak secrets if an attacker can specify which env var to read.",
    severity: "critical",
    remediation:
      "Never use user input as environment variable names. Use a static mapping of allowed env var names.",
  },
  {
    pattern: /(?:net|dgram|tls)\s*\.\s*(?:createServer|createConnection|connect|Socket)\s*\(/g,
    id: "PERM-040",
    title: "Raw socket/server creation",
    description:
      "The skill creates raw network sockets or servers. This provides low-level network access that bypasses higher-level security controls.",
    severity: "high",
    remediation:
      "Use higher-level HTTP libraries instead of raw sockets when possible. If sockets are necessary, bind only to localhost and validate all incoming connections.",
  },
  {
    pattern: /(?:clipboard|navigator\.clipboard)\s*\.\s*(?:read|readText|write|writeText)\s*\(/g,
    id: "PERM-050",
    title: "Clipboard access detected",
    description:
      "The skill accesses the system clipboard, which may contain sensitive data like passwords or private keys.",
    severity: "medium",
    remediation:
      "Minimize clipboard access. Only read/write when explicitly triggered by user action. Clear clipboard data after use.",
  },
  {
    pattern:
      /(?:os|child_process)\s*\.\s*(?:platform|arch|cpus|hostname|userInfo|networkInterfaces|totalmem|freemem)\s*\(/g,
    id: "PERM-060",
    title: "System information gathering",
    description:
      "The skill collects system information (hostname, network interfaces, user info). This data can aid in targeted attacks.",
    severity: "low",
    remediation:
      "Only collect system information that is strictly necessary. Avoid exposing this data to external services.",
  },
];

const WILDCARD_PERMISSION_PATTERNS: PermissionPattern[] = [
  {
    pattern: /["'](?:\*|all|admin|root|sudo|superuser)["']/gi,
    id: "PERM-070",
    title: "Wildcard or admin permission reference",
    description:
      "The skill references wildcard or administrative permissions. Skills should follow the principle of least privilege and request only the specific permissions they need.",
    severity: "high",
    remediation: "Replace wildcard permissions with specific, minimal permission grants.",
  },
];

export function checkPermissions(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  // Check manifest permissions
  checkManifestPermissions(skill, findings);

  // Check code-level permissions
  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!isCodeFile(ext)) continue;

    const allPatterns = [...CODE_PERMISSION_PATTERNS, ...WILDCARD_PERMISSION_PATTERNS];

    for (const def of allPatterns) {
      def.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = def.pattern.exec(file.content)) !== null) {
        if (isInComment(file.content, match.index)) continue;

        counter++;
        findings.push({
          id: `${def.id}-${counter}`,
          rule: "permissions",
          severity: def.severity,
          category: "excessive-permissions",
          title: def.title,
          description: def.description,
          file: file.relativePath,
          line: getLineNumber(file.content, match.index),
          evidence: getEvidenceLine(file.content, match.index),
          remediation: def.remediation,
        });
      }
    }

    // Check for permission escalation patterns
    checkEscalationPatterns(file, findings);
  }

  return findings;
}

function checkManifestPermissions(skill: AgentSkill, findings: SecurityFinding[]): void {
  const permissions = skill.manifest.permissions ?? [];

  // Check each declared permission against dangerous list
  for (const perm of permissions) {
    if (DANGEROUS_PERMISSIONS.includes(perm)) {
      findings.push({
        id: `PERM-M-${perm}`,
        rule: "permissions",
        severity: getDangerousPermSeverity(perm),
        category: "excessive-permissions",
        title: `Dangerous permission requested: ${perm}`,
        description: `The skill manifest requests the '${perm}' permission, which grants broad access to sensitive system resources. This permission should be carefully justified.`,
        file: "skill.json",
        evidence: `permissions: ["${perm}"]`,
        remediation: `Justify why '${perm}' is necessary. Consider requesting a more specific permission scope instead.`,
      });
    }
  }

  // Check for excessive number of permissions
  if (permissions.length > 5) {
    findings.push({
      id: "PERM-M-COUNT",
      rule: "permissions",
      severity: "medium",
      category: "excessive-permissions",
      title: `Excessive number of permissions (${permissions.length})`,
      description: `The skill requests ${permissions.length} permissions. Skills requesting many permissions have a larger attack surface and violate the principle of least privilege.`,
      file: "skill.json",
      evidence: `permissions: [${permissions.map((p) => `"${p}"`).join(", ")}]`,
      remediation:
        "Review all requested permissions and remove any that are not strictly necessary for the skill's core functionality.",
    });
  }
}

function getDangerousPermSeverity(perm: string): SecurityFinding["severity"] {
  const criticalPerms = ["shell:execute", "system:admin", "credentials:access"];
  const highPerms = ["filesystem:write", "network:unrestricted"];
  if (criticalPerms.includes(perm)) return "critical";
  if (highPerms.includes(perm)) return "high";
  return "medium";
}

function checkEscalationPatterns(file: SkillFile, findings: SecurityFinding[]): void {
  const lines = file.content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for sudo/privilege escalation
    if (/\bsudo\b|\bsu\s+-?\s*\w|setuid|setgid|seteuid|setegid/.test(line)) {
      findings.push({
        id: `PERM-ESC-${i}`,
        rule: "permissions",
        severity: "critical",
        category: "excessive-permissions",
        title: "Privilege escalation attempt",
        description:
          "The skill attempts to escalate privileges using sudo, su, or setuid operations. Agent skills should never require elevated system privileges.",
        file: file.relativePath,
        line: i + 1,
        evidence: line.trim(),
        remediation:
          "Remove all privilege escalation. Redesign the skill to operate within normal user permissions.",
      });
    }

    // Check for modifying system configuration
    if (/\/etc\/(?:passwd|shadow|sudoers|hosts|crontab|ssh)|\/proc\/|\/sys\//.test(line)) {
      findings.push({
        id: `PERM-SYS-${i}`,
        rule: "permissions",
        severity: "critical",
        category: "excessive-permissions",
        title: "Access to sensitive system paths",
        description:
          "The skill accesses sensitive system configuration files or kernel interfaces. This indicates excessive privilege requirements.",
        file: file.relativePath,
        line: i + 1,
        evidence: line.trim(),
        remediation:
          "Remove access to system configuration files. If system information is needed, use a purpose-built API that exposes only the required data.",
      });
    }
  }
}
