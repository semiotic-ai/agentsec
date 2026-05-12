/**
 * Types for the Skill Watch dataset served from
 * https://frames.ag/api/datasets/v1/microchipgnu/skill-watch/entities
 *
 * The upstream API wraps entities in a top-level array under either
 * `data` or `entities` depending on rollout — both are tolerated.
 */

export type SkillWatchFields = {
  owner: string;
  repo: string;
  skill_path: string;
  skill_name: string;
  score_overall: number;
  score_security: number;
  score_quality: number;
  score_maintenance: number;
  grade: string;
  findings_critical: number;
  findings_high: number;
  findings_medium: number;
  findings_low: number;
  has_vulnerabilities: boolean;
  is_web3: boolean;
  web3_confidence: string;
  has_readme: boolean;
  has_license: boolean;
  has_tests: boolean;
  last_scanned_at: string;
  agentsec_version: string;
  install_count: number;
  description: string;
  top_finding_rule: string;
  top_finding_owasp: string;
  hot_rank?: number;
  trending_rank?: number;
};

export type EvidenceEntry = {
  url?: string;
  retrieved_at?: string;
  title?: string;
  excerpt?: string;
};

export type SkillWatchEntity = {
  entity_id: string;
  fields: SkillWatchFields;
  evidence?: Record<string, EvidenceEntry>;
};

export type GradeKey = "A" | "B" | "C" | "D" | "F";
