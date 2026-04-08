import type { Config } from "@agentsec/cli";

/**
 * Agent Audit Configuration Example
 *
 * This file demonstrates all available configuration options for Agent Audit.
 * Copy this file to your project as `agentsec.config.ts` and customize
 * for your security requirements.
 *
 * Configuration is applied in this order (lowest to highest precedence):
 * 1. Built-in defaults
 * 2. Config file settings
 * 3. Environment variables (AGENTSEC_*)
 * 4. CLI arguments (--flag)
 */

export default {
  /**
   * Scanning Configuration
   * Controls how Agent Audit analyzes skills and generates findings.
   */
  scanning: {
    /**
     * Deep inspection level (1-3)
     * 1 = Metadata only (fast)
     * 2 = Standard analysis (recommended)
     * 3 = Deep code analysis (slowest, most thorough)
     * Default: 2
     */
    level: 2,

    /**
     * Whether to scan dependencies for vulnerabilities
     * Uses npm audit data and known vulnerability databases
     * Default: true
     */
    checkDependencies: true,

    /**
     * Maximum age of vulnerability data before refresh (days)
     * Set to 0 to always fetch latest data
     * Default: 7
     */
    vulnerabilityDataAge: 7,

    /**
     * Whether to analyze code for suspicious patterns
     * Checks for eval(), dynamic imports, unsafe deserialization, etc.
     * Default: true
     */
    analyzeCode: true,

    /**
     * Whether to validate OpenClaw (SKILL.md) metadata format
     * Checks structure, required fields, and data types
     * Default: true
     */
    validateMetadata: true,

    /**
     * Whether to check for permission escalation patterns
     * Validates declared permissions against actual API usage
     * Default: true
     */
    checkPermissions: true,

    /**
     * Timeout for scanning a single skill (milliseconds)
     * Default: 30000 (30 seconds)
     */
    timeout: 30000,
  },

  /**
   * Policy Configuration
   * Defines security policies and compliance rules.
   */
  policy: {
    /**
     * Which built-in policy preset to use
     * - 'strict': No medium/high/critical findings allowed
     * - 'balanced': Medium findings allowed, high/critical blocked (recommended)
     * - 'permissive': Only critical findings block deployment
     * - 'custom': Use the rules defined in customRules below
     * Default: 'balanced'
     */
    preset: "balanced",

    /**
     * Custom policy rules (used only if preset: 'custom')
     * Each rule defines a security requirement
     */
    customRules: [
      {
        id: "rule-001",
        name: "No eval() or dynamic code execution",
        severity: "critical",
        pattern: "eval\\(|new Function\\(",
        description: "Skills must not use eval() or similar dynamic code execution",
      },
      {
        id: "rule-002",
        name: "Dependencies must be pinned",
        severity: "high",
        pattern: "\\^|~|latest",
        description: "Use exact version numbers for all dependencies",
      },
    ],

    /**
     * Which OWASP AST categories to enforce
     * true = enforce, false = allow, null = audit only
     */
    owasp: {
      AST01_MaliciousSkills: true,
      AST02_SupplyChainCompromise: true,
      AST03_OverPrivilegedSkills: true,
      AST04_InsecureMetadata: true,
      AST05_UnsafeDeserialization: true,
      AST06_WeakIsolation: true,
      AST07_UpdateDrift: true,
      AST08_PoorScanning: true,
      AST09_NoGovernance: true,
      AST10_CrossPlatformReuse: true,
    },

    /**
     * Maximum allowed severity level
     * 'critical' = no critical findings allowed
     * 'high' = critical+high blocked
     * 'medium' = all findings allowed but reported
     * 'low' = informational only
     * Default: 'high'
     */
    maxSeverity: "high",

    /**
     * Whether to require certification for deployment
     * If true, only certified skills pass compliance checks
     * Default: false
     */
    requireCertification: false,

    /**
     * Custom remediation guidance per rule
     */
    remediation: {
      "rule-001":
        "Remove eval() and dynamic code execution. Use static imports and predefined functions instead.",
      "rule-002":
        'Update package.json to use exact versions (remove ^ and ~). Example: "express": "4.18.2"',
    },
  },

  /**
   * Report Configuration
   * Controls output format and content of audit reports.
   */
  report: {
    /**
     * Output formats to generate
     * Supported: 'html', 'json', 'pdf', 'sarif', 'junit'
     * Default: ['html', 'json']
     */
    formats: ["html", "json"],

    /**
     * Include detailed findings in reports
     * If false, only summary statistics are included
     * Default: true
     */
    includeDetails: true,

    /**
     * Include remediation guidance
     * Shows how to fix each finding
     * Default: true
     */
    includeRemediation: true,

    /**
     * Include code snippets in findings
     * Useful for code-based findings, can expose sensitive code
     * Default: true
     */
    includeCodeSnippets: true,

    /**
     * Maximum length of code snippets (characters)
     * Prevents exposure of large code blocks
     * Default: 500
     */
    maxSnippetLength: 500,

    /**
     * Title for the report
     * Default: "Agent Audit Security Report"
     */
    title: "Agent Audit Security Report",

    /**
     * Custom branding in reports
     * null = use defaults
     */
    branding: {
      logoUrl: "https://agentsec.dev/logo.svg",
      companyName: "Agent Audit",
      reporterEmail: "security@yourorg.dev",
    },

    /**
     * Include OWASP mapping in reports
     * Shows which AST categories each finding relates to
     * Default: true
     */
    includeOWASPMapping: true,

    /**
     * Include compliance checklist
     * Shows pass/fail for each policy rule
     * Default: true
     */
    includeCompliance: true,
  },

  /**
   * Storage Configuration
   * Where to save audit results and cache data.
   */
  storage: {
    /**
     * Output directory for reports
     * Relative paths are resolved from current working directory
     * Default: './audit-reports'
     */
    reportDir: "./audit-reports",

    /**
     * Cache directory for scan results and vulnerability data
     * Default: './.agentsec-cache'
     */
    cacheDir: "./.agentsec-cache",

    /**
     * Whether to save raw scan data alongside reports
     * Useful for integration with other tools
     * Default: false
     */
    saveScanData: false,

    /**
     * Maximum age of cached scan data (days)
     * Older caches are invalidated
     * Default: 30
     */
    maxCacheAge: 30,
  },

  /**
   * Notifications Configuration
   * Where to send audit results and alerts.
   */
  notifications: {
    /**
     * Whether to send notifications for audit completion
     * Default: false
     */
    enabled: false,

    /**
     * Email addresses to notify on critical findings
     * Requires email integration to be configured
     */
    criticalFindingsEmail: ["security@yourorg.dev"],

    /**
     * Webhook URL for audit notifications
     * Receives POST with audit results
     */
    webhookUrl: null,

    /**
     * Slack channel for notifications
     * Format: #channel or webhook URL
     */
    slackChannel: null,

    /**
     * Notify on policy violations
     * Default: true
     */
    notifyOnPolicyViolation: true,
  },

  /**
   * Performance Configuration
   * Controls scanning speed and resource usage.
   */
  performance: {
    /**
     * Maximum number of skills to scan in parallel
     * Higher = faster but uses more memory
     * Default: 4
     */
    concurrency: 4,

    /**
     * Whether to use caching for duplicate skills
     * Speeds up repeated scans of same skills
     * Default: true
     */
    enableCache: true,

    /**
     * Whether to skip already-scanned skills
     * Only scan skills newer than last audit
     * Default: false
     */
    incrementalScans: false,
  },

  /**
   * Integration Configuration
   * Connect Agent Audit with other tools and platforms.
   */
  integrations: {
    /**
     * GitHub Integration
     * Enables inline comments on PRs with security findings
     */
    github: {
      enabled: false,
      token: process.env.GITHUB_TOKEN,
      /**
       * Whether to comment on PRs with findings
       * Default: true
       */
      commentOnPR: true,
      /**
       * Whether to fail CI/CD if findings detected
       * Default: true for critical, false for others
       */
      failOnFindings: true,
    },

    /**
     * JIRA Integration
     * Automatically create tickets for high-severity findings
     */
    jira: {
      enabled: false,
      baseUrl: process.env.JIRA_BASE_URL,
      username: process.env.JIRA_USERNAME,
      apiToken: process.env.JIRA_API_TOKEN,
      projectKey: "SEC",
      issuetype: "Bug",
      /**
       * Create tickets for which severity levels?
       */
      createTicketsFor: ["critical", "high"],
    },

    /**
     * Datadog Integration
     * Send metrics and findings to Datadog
     */
    datadog: {
      enabled: false,
      apiKey: process.env.DATADOG_API_KEY,
      site: "datadoghq.com",
      tags: ["agentsec", "security"],
    },
  },

  /**
   * Logging Configuration
   * Controls verbosity and log output.
   */
  logging: {
    /**
     * Logging level
     * 'debug' = verbose, 'info' = normal, 'warn' = errors only
     * Default: 'info'
     */
    level: "info",

    /**
     * Whether to log to file
     * Default: false
     */
    file: {
      enabled: false,
      path: "./audit.log",
    },

    /**
     * Whether to include timestamps in logs
     * Default: true
     */
    timestamps: true,

    /**
     * Whether to colorize console output
     * Default: true (auto-detect TTY)
     */
    colors: "auto",
  },

  /**
   * Security Configuration
   * Advanced security settings and restrictions.
   */
  security: {
    /**
     * Whether to allow scanning from untrusted sources
     * Default: false (only local and signed sources)
     */
    allowUntrustedSources: false,

    /**
     * Whether to validate skill signatures
     * Requires skills to be signed by trusted signers
     * Default: true
     */
    requireSignatures: true,

    /**
     * Trusted signature public keys (PEM format)
     */
    trustedKeys: [
      // Add trusted public keys here
      // format: 'LS0tLS1CRUdJTi...(base64-encoded PEM)...tLS0tLS0='
    ],

    /**
     * Whether to sandbox code execution during analysis
     * Prevents potentially malicious code from running
     * Default: true
     */
    useSandbox: true,

    /**
     * Whether to mask sensitive data in reports
     * Hides API keys, tokens, credentials from output
     * Default: true
     */
    maskSensitiveData: true,
  },

  /**
   * Advanced Configuration
   * For power users and custom deployments.
   */
  advanced: {
    /**
     * Custom rule file paths
     * Load additional rules from external files
     */
    customRuleFiles: [
      // './rules/internal-policies.js',
      // './rules/compliance-rules.js',
    ],

    /**
     * Custom scanner plugins
     * Extend scanning with proprietary logic
     */
    plugins: [
      // { name: 'custom-scanner', options: { /* ... */ } },
    ],

    /**
     * Environment variables to inject during scanning
     * Use for API keys, configuration flags, etc.
     * WARNING: Don't commit secrets!
     */
    env: {
      // CUSTOM_VAR: 'value',
    },

    /**
     * Whether to validate this config on startup
     * Default: true
     */
    validateConfig: true,
  },
} satisfies Config;

/**
 * Configuration Tips:
 *
 * 1. Environment Variables:
 *    Prefix any config field with AGENTSEC_ to override via env var
 *    Example: AGENTSEC_POLICY_MAXSEVERITY=critical
 *
 * 2. Secrets Management:
 *    Never commit API keys or tokens to this file.
 *    Use environment variables or a secrets manager instead.
 *    Example: token: process.env.GITHUB_TOKEN
 *
 * 3. CI/CD Integration:
 *    Set AGENTSEC_REPORT_FORMATS=sarif for integration with code scanners
 *    Use AGENTSEC_POLICY_FAILONSEVERITY to fail builds on findings
 *
 * 4. Multiple Environments:
 *    Create separate configs: agentsec.dev.ts, agentsec.prod.ts
 *    Load based on NODE_ENV: require(`./agentsec.${process.env.NODE_ENV}.ts`)
 *
 * 5. Validation:
 *    Run: bun run agentsec config --validate
 *    to check your configuration before deployment
 */
