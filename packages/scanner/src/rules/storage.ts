import type { AgentSkill, SecurityFinding, SkillFile } from "@agent-audit/shared";
import { getLineNumber, getEvidenceLine, isInComment } from "./utils";

/**
 * Rule: Insecure Credential/Secret Storage (AST-05)
 *
 * Detects hardcoded secrets, API keys, tokens, and passwords in source
 * code. Checks for insecure storage patterns such as plaintext config
 * files, weak encryption, and missing encryption at rest.
 */

interface SecretPattern {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
}

const HARDCODED_SECRET_PATTERNS: SecretPattern[] = [
  {
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][a-zA-Z0-9_\-]{16,}["']/gi,
    id: "STOR-001",
    title: "Hardcoded API key detected",
    description:
      "An API key appears to be hardcoded in the source code. Hardcoded keys are exposed in version control and can be extracted from distributed artifacts.",
    severity: "critical",
    remediation:
      "Move the API key to environment variables or a secrets management system. Use .env files for local development (add .env to .gitignore).",
  },
  {
    pattern: /(?:secret|secret[_-]?key|client[_-]?secret)\s*[:=]\s*["'][a-zA-Z0-9_\-/+=]{8,}["']/gi,
    id: "STOR-002",
    title: "Hardcoded secret/key detected",
    description:
      "A secret or client secret appears to be hardcoded. Secrets in source code are easily discoverable and cannot be rotated without code changes.",
    severity: "critical",
    remediation:
      "Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) or environment variables. Never commit secrets to version control.",
  },
  {
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{4,}["']/gi,
    id: "STOR-003",
    title: "Hardcoded password detected",
    description:
      "A password is hardcoded in the source code. This is a critical security issue as the password is visible to anyone with code access.",
    severity: "critical",
    remediation:
      "Remove hardcoded passwords. Use environment variables, a secrets manager, or prompt for credentials at runtime.",
  },
  {
    pattern:
      /(?:token|auth[_-]?token|access[_-]?token|bearer)\s*[:=]\s*["'][a-zA-Z0-9_\-./+=]{16,}["']/gi,
    id: "STOR-004",
    title: "Hardcoded token detected",
    description:
      "An authentication token appears to be hardcoded. Tokens in source code can be extracted and used to impersonate the skill or its users.",
    severity: "critical",
    remediation:
      "Use a token management system. Fetch tokens at runtime from a secure credentials provider.",
  },
  {
    pattern:
      /(?:private[_-]?key|privatekey)\s*[:=]\s*["']-----BEGIN\s+(?:RSA|EC|OPENSSH|PGP)\s+PRIVATE\s+KEY/gi,
    id: "STOR-005",
    title: "Hardcoded private key detected",
    description:
      "A private key is embedded in the source code. Private keys must be kept confidential; their exposure compromises all cryptographic operations relying on them.",
    severity: "critical",
    remediation:
      "Store private keys in a hardware security module (HSM), key management system, or at minimum in a protected file with restricted permissions. Never commit private keys to version control.",
  },
  {
    pattern: /-----BEGIN\s+(?:RSA|EC|OPENSSH|PGP)\s+PRIVATE\s+KEY-----/g,
    id: "STOR-006",
    title: "Private key material in source file",
    description:
      "Raw private key material (PEM format) is present in the source file. This key is exposed to anyone who can read the code.",
    severity: "critical",
    remediation:
      "Remove the private key from source code immediately. Rotate the key and store the new key securely.",
  },
  {
    pattern:
      /(?:aws[_-]?(?:access[_-]?key[_-]?id|secret[_-]?access[_-]?key))\s*[:=]\s*["'][A-Za-z0-9/+=]{16,}["']/gi,
    id: "STOR-007",
    title: "Hardcoded AWS credentials",
    description:
      "AWS access keys are hardcoded in the source. These can be used to access and modify AWS resources associated with the account.",
    severity: "critical",
    remediation:
      "Use IAM roles, AWS SSO, or environment variables. Configure the AWS SDK to use the default credential provider chain.",
  },
  {
    pattern: /(?:AKIA[0-9A-Z]{16})/g,
    id: "STOR-008",
    title: "AWS Access Key ID pattern detected",
    description:
      "A string matching the AWS Access Key ID format (AKIA...) is present. This is likely a real AWS key that should not be in source code.",
    severity: "critical",
    remediation:
      "Remove the AWS key, rotate it immediately, and use IAM roles or environment variables instead.",
  },
  {
    pattern: /(?:ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})/g,
    id: "STOR-009",
    title: "GitHub token detected",
    description: "A GitHub personal access token or OAuth token is present in the source code.",
    severity: "critical",
    remediation:
      "Revoke the token, generate a new one, and store it as an environment variable or secret.",
  },
  {
    pattern: /(?:sk-[a-zA-Z0-9]{32,})/g,
    id: "STOR-010",
    title: "OpenAI/Stripe-style API key detected",
    description:
      "A string matching the format of an OpenAI or Stripe secret key (sk-...) is present in the source code.",
    severity: "critical",
    remediation: "Revoke the key, generate a new one, and store it as an environment variable.",
  },
  {
    pattern: /(?:xox[bpas]-[a-zA-Z0-9-]{10,})/g,
    id: "STOR-011",
    title: "Slack token detected",
    description: "A Slack API token (xoxb-, xoxp-, xoxa-, xoxs-) is present in the source code.",
    severity: "critical",
    remediation: "Revoke the token and store the new one in environment variables.",
  },
];

const INSECURE_STORAGE_PATTERNS: SecretPattern[] = [
  {
    pattern:
      /localStorage\s*\.\s*setItem\s*\(\s*["'](?:token|key|secret|password|auth|credential|session)/gi,
    id: "STOR-020",
    title: "Sensitive data in localStorage",
    description:
      "Sensitive credentials are stored in localStorage, which is accessible to any JavaScript on the same origin, including XSS payloads.",
    severity: "high",
    remediation:
      "Use httpOnly cookies for session tokens. If client-side storage is necessary, use the Web Crypto API with encryption.",
  },
  {
    pattern:
      /sessionStorage\s*\.\s*setItem\s*\(\s*["'](?:token|key|secret|password|auth|credential)/gi,
    id: "STOR-021",
    title: "Sensitive data in sessionStorage",
    description:
      "Sensitive credentials in sessionStorage are accessible to XSS attacks on the same origin.",
    severity: "medium",
    remediation:
      "Use httpOnly cookies for session tokens. Avoid storing credentials in browser storage.",
  },
  {
    pattern:
      /document\s*\.\s*cookie\s*=\s*(?:(?!.*(?:httponly|httpOnly|HttpOnly|secure|Secure)))/gi,
    id: "STOR-022",
    title: "Cookie set without security flags",
    description:
      "Cookies are set without httpOnly and/or Secure flags. Without httpOnly, cookies are accessible to JavaScript (XSS). Without Secure, they are transmitted over unencrypted HTTP.",
    severity: "medium",
    remediation:
      "Set cookies with httpOnly, Secure, and SameSite=Strict flags. Use a cookie library that sets secure defaults.",
  },
  {
    pattern:
      /(?:writeFile|writeFileSync)\s*\([^)]*(?:\.env|credentials|secret|key|password|token|config)/gi,
    id: "STOR-023",
    title: "Writing credentials to file",
    description:
      "The skill writes credential-like data to a file. Files may have incorrect permissions, be backed up, or be accessible to other processes.",
    severity: "high",
    remediation:
      "Use a platform-provided secrets manager or keychain. If file storage is necessary, use proper file permissions (0600) and encrypt at rest.",
  },
  {
    pattern:
      /console\s*\.\s*(?:log|info|debug|warn|error)\s*\([^)]*(?:password|secret|token|key|credential|api[_-]?key)\b/gi,
    id: "STOR-024",
    title: "Credential data logged to console",
    description:
      "Sensitive credentials are being logged. Log output is often captured in monitoring systems, log files, and third-party services where they can be exposed.",
    severity: "high",
    remediation:
      "Never log credentials. Use a logging framework that supports redaction of sensitive fields.",
  },
];

const WEAK_CRYPTO_PATTERNS: SecretPattern[] = [
  {
    pattern: /createHash\s*\(\s*["'](?:md5|sha1|md4)["']\s*\)/gi,
    id: "STOR-030",
    title: "Weak hash algorithm used",
    description:
      "MD5 or SHA1 are used for hashing. These algorithms have known collision attacks and should not be used for security-sensitive operations.",
    severity: "high",
    remediation:
      "Use SHA-256 or SHA-3 for hashing. For password hashing, use bcrypt, scrypt, or Argon2.",
  },
  {
    pattern: /createCipher\s*\(\s*["'](?:des|rc4|rc2|blowfish|des-ede)["']/gi,
    id: "STOR-031",
    title: "Weak encryption algorithm used",
    description:
      "Weak or broken encryption algorithms (DES, RC4, RC2, Blowfish) are used. These can be broken with modern computing resources.",
    severity: "high",
    remediation: "Use AES-256-GCM or ChaCha20-Poly1305 for encryption.",
  },
  {
    pattern: /createCipher\b/g,
    id: "STOR-032",
    title: "Deprecated crypto.createCipher usage",
    description:
      "crypto.createCipher is deprecated because it derives the key using MD5 without salt, making it weak. Use createCipheriv instead.",
    severity: "medium",
    remediation:
      "Use crypto.createCipheriv with a proper IV and key derivation function (PBKDF2, scrypt).",
  },
  {
    pattern: /(?:btoa|atob)\s*\(\s*(?:password|secret|key|token|credential)/gi,
    id: "STOR-033",
    title: "Base64 used for credentials (not encryption)",
    description:
      "Base64 encoding is used on credentials. Base64 is an encoding, not encryption. It provides zero security and is trivially reversible.",
    severity: "high",
    remediation: "Use proper encryption (AES-256-GCM) instead of Base64 encoding for credentials.",
  },
];

const ALL_PATTERNS: SecretPattern[] = [
  ...HARDCODED_SECRET_PATTERNS,
  ...INSECURE_STORAGE_PATTERNS,
  ...WEAK_CRYPTO_PATTERNS,
];

export function checkStorage(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!isScannableFile(ext)) continue;

    // Skip test files and fixtures for hardcoded secret patterns
    const isTestFile = /(?:test|spec|fixture|mock|__test__|__mock__)/.test(file.relativePath);

    for (const def of ALL_PATTERNS) {
      // Be lenient with test files for hardcoded values
      if (isTestFile && def.id.startsWith("STOR-00")) continue;

      def.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = def.pattern.exec(file.content)) !== null) {
        if (isInComment(file.content, match.index)) continue;
        // Skip obvious test/example values
        if (isExampleValue(file.content, match.index)) continue;

        counter++;
        findings.push({
          id: `${def.id}-${counter}`,
          rule: "storage",
          severity: def.severity,
          category: "insecure-storage",
          title: def.title,
          description: def.description,
          file: file.relativePath,
          line: getLineNumber(file.content, match.index),
          evidence: redactEvidence(getEvidenceLine(file.content, match.index)),
          remediation: def.remediation,
        });
      }
    }

    // Check for .env files committed (by looking at references)
    checkEnvFileReferences(file, findings);
  }

  // Check for missing .gitignore patterns
  checkGitignoreForSecrets(skill, findings);

  return findings;
}

function checkEnvFileReferences(file: SkillFile, findings: SecurityFinding[]): void {
  // Check if .env files are being read directly
  const envReadPattern = /(?:readFile|readFileSync|dotenv|config)\s*\([^)]*\.env\b/g;
  envReadPattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = envReadPattern.exec(file.content)) !== null) {
    // This is informational -- .env usage is common but should be noted
    findings.push({
      id: `STOR-ENV-${getLineNumber(file.content, match.index)}`,
      rule: "storage",
      severity: "info",
      category: "insecure-storage",
      title: "Environment file usage detected",
      description:
        "The skill reads from .env files. Ensure .env files are excluded from version control and contain only non-production credentials for local development.",
      file: file.relativePath,
      line: getLineNumber(file.content, match.index),
      evidence: getEvidenceLine(file.content, match.index),
      remediation:
        "Add .env to .gitignore. Use environment variables from the deployment platform for production.",
    });
  }
}

function checkGitignoreForSecrets(skill: AgentSkill, findings: SecurityFinding[]): void {
  const gitignoreFile = skill.files.find((f) => f.relativePath === ".gitignore");
  if (!gitignoreFile) {
    findings.push({
      id: "STOR-GIT-MISSING",
      rule: "storage",
      severity: "medium",
      category: "insecure-storage",
      title: "No .gitignore file found",
      description:
        "The skill has no .gitignore file. Without it, sensitive files (.env, credentials, private keys) may be committed to version control.",
      remediation:
        "Add a .gitignore file that excludes .env, *.pem, *.key, credentials.json, and other sensitive files.",
    });
    return;
  }

  const importantExclusions = [".env", "*.pem", "*.key", "credentials"];
  const missingExclusions = importantExclusions.filter(
    (exclusion) => !gitignoreFile.content.includes(exclusion),
  );

  if (missingExclusions.length > 0) {
    findings.push({
      id: "STOR-GIT-INCOMPLETE",
      rule: "storage",
      severity: "low",
      category: "insecure-storage",
      title: "Incomplete .gitignore for secrets",
      description: `The .gitignore file does not exclude: ${missingExclusions.join(", ")}. Sensitive files matching these patterns could be committed.`,
      file: ".gitignore",
      evidence: `Missing patterns: ${missingExclusions.join(", ")}`,
      remediation: `Add the following patterns to .gitignore: ${missingExclusions.join(", ")}`,
    });
  }
}

function isExampleValue(content: string, index: number): boolean {
  const line = getEvidenceLine(content, index).toLowerCase();
  const exampleIndicators = [
    "example",
    "placeholder",
    "xxx",
    "your_",
    "replace_",
    "changeme",
    "todo",
    "fixme",
    "test",
    "sample",
    "demo",
    "dummy",
    "fake",
    "mock",
  ];
  return exampleIndicators.some((indicator) => line.includes(indicator));
}

function redactEvidence(evidence: string): string {
  // Redact actual secret values while preserving the pattern for analysis
  return evidence.replace(/(["'])[a-zA-Z0-9_\-/+=]{16,}(\1)/g, "$1[REDACTED]$2");
}

function isScannableFile(ext: string): boolean {
  return [
    "ts",
    "tsx",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "sh",
    "bash",
    "zsh",
    "fish",
    "yaml",
    "yml",
    "json",
    "toml",
    "env",
    "html",
    "htm",
    "vue",
    "svelte",
  ].includes(ext);
}
