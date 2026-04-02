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
  [key: string]: unknown;
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
  | "unsafe-deserialization";

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
