/** Represents a discovered agent skill on disk */
export interface AgentSkill {
  /** Unique identifier for the skill */
  id: string;
  /** Human-readable name */
  name: string;
  /** Skill version */
  version: string;
  /** Absolute path to skill directory */
  path: string;
  /** Agent platform (openclaw, claude, codex) */
  platform: AgentPlatform;
  /** Skill metadata from manifest */
  manifest: SkillManifest;
  /** Raw source files */
  files: SkillFile[];
  /** The default-discovery root directory this skill was found under. Optional — set only when discovered via auto-discover. */
  sourceRoot?: string;
  /** Platform inferred from `sourceRoot` path. Optional — set only when discovered via auto-discover. Distinct from `platform` which reflects the skill's manifest-declared platform. */
  discoveredAs?: AgentPlatform;
}

export type AgentPlatform = "openclaw" | "claude" | "codex";

export interface SkillManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  permissions?: string[];
  dependencies?: Record<string, string>;
  entrypoint?: string;
  hooks?: Record<string, string>;
  /** Optional Web3 capability declaration consumed by the AST-10 Web3 Annex (`@agentsec/web3`). */
  web3?: Web3ManifestBlock;
  [key: string]: unknown;
}

/**
 * Optional Web3 capability declaration. Consumed by the AST-10 Web3 Annex
 * rule pack (`@agentsec/web3`). All fields optional; absence of fields the
 * annex expects is itself a finding (see AST-W01, AST-W12).
 */
export interface Web3ManifestBlock {
  /** Declared chain IDs the skill operates on (e.g. 1, 8453, 42161). */
  chains?: number[];
  /** Signer types the skill may use. */
  signers?: ("hot" | "session" | "tee" | "external")[];
  /** Per-call and aggregate signing-policy caps. */
  policy?: {
    maxValuePerTx?: string;
    allowedContracts?: string[];
    allowedSelectors?: string[];
    allowedChains?: number[];
    dailyCap?: string;
    expiry?: number;
  };
  /** MCP servers the skill expects, with optional pinning. */
  mcpServers?: { url: string; pinnedHash?: string; pinnedVersion?: string }[];
  /** Tamper-evident audit sink declaration (see AST-W12). */
  audit?: { sink?: string };
  /** Out-of-band kill-switch declaration (see AST-W12). */
  killSwitch?: { contract?: string; chainId?: number };
  /** Oracle/price source declaration when the skill performs swaps (see AST-W10). */
  oracle?: { source?: string; type?: "twap" | "chainlink" | "pyth" | "redstone" | "spot" };
  /** Bridge provider declaration when chains.length > 1 (see AST-W07). */
  bridgeProvider?: string;
  /** Session-key permission declarations (ERC-7715-style; see AST-W09). */
  sessionKey?: {
    expiry?: number;
    valueLimit?: string;
    targets?: string[];
    selectors?: string[];
    chainIds?: number[];
    caveatEnforcer?: string;
  };
  /** Incident response runbook URL (see AST-W12). */
  incident?: { runbook?: string };
  /** Whether the skill constructs EIP-7702 SetCodeAuthorization (see AST-W03). */
  signs7702?: boolean;
  /** Pinned RPC registry URL (see AST-W05). */
  rpcRegistry?: string;
}

export interface SkillFile {
  path: string;
  relativePath: string;
  content: string;
  language: string;
  size: number;
}

/** Result of a full audit run */
export interface AuditReport {
  id: string;
  timestamp: string;
  platform: AgentPlatform;
  skills: SkillAuditResult[];
  summary: AuditSummary;
}

export interface SkillAuditResult {
  skill: AgentSkill;
  score: AuditScore;
  securityFindings: SecurityFinding[];
  qualityMetrics: QualityMetrics;
  policyViolations: PolicyViolation[];
  recommendations: Recommendation[];
  /**
   * Web3 capability detection summary. Populated when the auditor ran
   * detection (always, in current CLI versions). `detected: true` means
   * the AST-10 Web3 Annex (`@agentsec/web3`) rules were applied to this
   * skill.
   */
  web3?: Web3DetectionResult;
}

/**
 * Outcome of running the Web3 capability detector against a skill.
 * Mirrors `Web3Detection` in `@agentsec/web3`; lives here so consumers
 * can read result objects without depending on the annex package.
 */
export interface Web3DetectionResult {
  detected: boolean;
  confidence: "definite" | "likely" | "weak" | "no";
  signals: string[];
}

export interface AuditScore {
  overall: number; // 0-100
  security: number;
  quality: number;
  maintenance: number;
  grade: AuditGrade;
}

export type AuditGrade = "A" | "B" | "C" | "D" | "F";

export interface SecurityFinding {
  id: string;
  rule: string;
  severity: Severity;
  category: OWASPCategory;
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  evidence?: string;
  cve?: string;
  remediation?: string;
  /**
   * OWASP Agentic Skills Top 10 identifier (e.g. "AST01", "AST-W02"). Stamped
   * onto every finding by `Scanner.scan()` from the matching `RuleDefinition`,
   * so downstream consumers (text/HTML/SARIF reports, ClawHub badges, EAS
   * attestations) can surface the canonical category without re-deriving it
   * from the rule slug.
   */
  owaspId?: string;
  /** Canonical link for `owaspId` (e.g. AST10 OWASP page or the AST-W## annex doc). */
  owaspLink?: string;
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type OWASPCategory =
  | "skill-injection"
  | "excessive-permissions"
  | "insecure-output"
  | "dependency-vulnerability"
  | "insecure-storage"
  | "insufficient-logging"
  | "denial-of-service"
  | "supply-chain"
  | "improper-error-handling"
  | "unsafe-deserialization"
  // AST-10 Web3 Annex (AST-W01..W12) — see `packages/web3` and
  // docs/plans/ast10-web3-annex-rules.md.
  | "web3-signing-authority"
  | "web3-permit-capture"
  | "web3-eip7702-delegation"
  | "web3-blind-signing"
  | "web3-rpc-substitution"
  | "web3-contract-targets"
  | "web3-bridge-replay"
  | "web3-mcp-chain-drift"
  | "web3-session-key-erosion"
  | "web3-oracle-manipulation"
  | "web3-key-material-leak"
  | "web3-no-audit-killswitch"
  | "web3-metadata-completeness";

export interface QualityMetrics {
  codeComplexity: number;
  testCoverage: number | null;
  documentationScore: number;
  maintenanceHealth: number;
  dependencyCount: number;
  outdatedDependencies: number;
  hasReadme: boolean;
  hasLicense: boolean;
  hasTests: boolean;
  hasTypes: boolean;
  linesOfCode: number;
}

export interface PolicyViolation {
  policy: string;
  severity: Severity;
  message: string;
  action: PolicyAction;
}

export type PolicyAction = "block" | "warn" | "info";

export interface Recommendation {
  category: "security" | "quality" | "maintenance";
  priority: Severity;
  title: string;
  description: string;
  effort: "low" | "medium" | "high";
}

export interface AuditSummary {
  totalSkills: number;
  averageScore: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  blockedSkills: number;
  certifiedSkills: number;
}

/** Policy configuration */
export interface PolicyConfig {
  name: string;
  rules: PolicyRule[];
}

export interface PolicyRule {
  id: string;
  description: string;
  severity: Severity;
  action: PolicyAction;
  condition: PolicyCondition;
}

export interface PolicyCondition {
  type: "score-below" | "finding-exists" | "permission-used" | "dependency-banned" | "custom";
  value: unknown;
}

/** CLI output format */
export type OutputFormat = "text" | "json" | "sarif" | "html";

/** Scanner plugin interface */
export interface ScannerPlugin {
  name: string;
  version: string;
  scan(skill: AgentSkill): Promise<SecurityFinding[]>;
}
