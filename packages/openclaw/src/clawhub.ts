/**
 * ClawHub registry integration types and interfaces.
 *
 * Defines the contract for interacting with the ClawHub skill registry
 * (clawhub.ai) and the skills.sh registry (Vercel Labs). No HTTP calls
 * are made here -- this module provides types and a stub function that
 * will be backed by a real implementation in a future phase.
 *
 * @module clawhub
 */

import type { AgentSkill, SkillManifest } from "@agent-audit/shared";

// ---------------------------------------------------------------------------
// ClawHub registry types
// ---------------------------------------------------------------------------

/** Metadata for a skill hosted on the ClawHub registry. */
export interface ClawHubSkillInfo {
  /** URL-safe slug identifier (e.g. "code-review") */
  slug: string;
  /** Display name */
  name: string;
  /** Semver version string */
  version: string;
  /** Short description used in search results */
  description: string;
  /** Author or publisher identifier */
  author: string;
  /** Total install/download count */
  downloads: number;
  /** ISO-8601 timestamp of the initial publish */
  createdAt: string;
  /** ISO-8601 timestamp of the most recent version */
  updatedAt: string;
  /** Tags assigned by the author */
  tags: string[];
  /** Homepage or documentation URL */
  homepage?: string;
  /** License identifier (e.g. "MIT") */
  license?: string;
  /** Whether the skill has been soft-deleted */
  deleted: boolean;
}

/** A specific published version of a ClawHub skill. */
export interface ClawHubVersionEntry {
  /** Semver version */
  version: string;
  /** ISO-8601 publish timestamp */
  publishedAt: string;
  /** Optional changelog text */
  changelog?: string;
  /** SHA-256 content hash of the bundle */
  contentHash: string;
}

/** Search result returned by the registry. */
export interface ClawHubSearchResult {
  /** Matching skills */
  items: ClawHubSkillInfo[];
  /** Total number of results across all pages */
  total: number;
  /** Current page (1-indexed) */
  page: number;
  /** Results per page */
  perPage: number;
}

/** Options for searching the ClawHub registry. */
export interface ClawHubSearchOptions {
  /** Search query string */
  query: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Page number (1-indexed) */
  page?: number;
  /** Filter by tag */
  tag?: string;
}

// ---------------------------------------------------------------------------
// skills.sh registry types
// ---------------------------------------------------------------------------

/** Metadata for a skill listed on skills.sh. */
export interface SkillsRegistryInfo {
  /** Skill identifier (owner/repo/skillId format) */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** GitHub repository source (owner/repo) */
  repository: string;
  /** Path within the repository */
  path: string;
  /** List of supported agent platforms */
  agents: string[];
  /** Whether the skill is marked internal */
  internal: boolean;
}

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

/**
 * Interface for interacting with the ClawHub skill registry.
 *
 * Implementations may shell out to the `clawhub` CLI, call the HTTP API
 * directly, or use a combination of both.
 */
export interface ClawHubClient {
  /** Search the registry for skills matching a query. */
  search(options: ClawHubSearchOptions): Promise<ClawHubSearchResult>;

  /** Fetch full metadata for a single skill by slug. */
  inspect(slug: string): Promise<ClawHubSkillInfo | null>;

  /** Get the parsed manifest (SKILL.md frontmatter) for a skill. */
  getMetadata(slug: string, version?: string): Promise<SkillManifest | null>;

  /** List all published versions of a skill. */
  listVersions(slug: string): Promise<ClawHubVersionEntry[]>;
}

/**
 * Interface for interacting with the skills.sh registry.
 */
export interface SkillsRegistryClient {
  /** Search for skills by keyword. */
  find(query: string, limit?: number): Promise<SkillsRegistryInfo[]>;

  /** List skills installed locally. */
  listInstalled(): Promise<SkillsRegistryInfo[]>;

  /** Check for available updates. */
  checkUpdates(): Promise<Array<{ id: string; current: string; latest: string }>>;
}

// ---------------------------------------------------------------------------
// Registry configuration
// ---------------------------------------------------------------------------

/** Configuration for connecting to a skill registry. */
export interface RegistryConfig {
  /** Base URL of the registry API */
  registryUrl: string;
  /** Optional authentication token */
  authToken?: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
}

/** Default registry URLs. */
export const CLAWHUB_REGISTRY_URL = "https://api.clawhub.ai";
export const SKILLS_REGISTRY_URL = "https://skills.sh";

/** Default configuration for ClawHub registry access. */
export const DEFAULT_CLAWHUB_CONFIG: RegistryConfig = {
  registryUrl: CLAWHUB_REGISTRY_URL,
  timeoutMs: 15_000,
};

/** Default configuration for skills.sh registry access. */
export const DEFAULT_SKILLS_CONFIG: RegistryConfig = {
  registryUrl: SKILLS_REGISTRY_URL,
  timeoutMs: 15_000,
};

// ---------------------------------------------------------------------------
// Stub function
// ---------------------------------------------------------------------------

/**
 * Fetch a skill from the ClawHub registry and return it as an AgentSkill.
 *
 * This is a stub that will be replaced with a real implementation once the
 * HTTP client layer is built. Currently returns `null` for all inputs.
 *
 * @param slug - The skill slug to fetch (e.g. "code-review")
 * @param config - Optional registry configuration overrides
 * @returns The fetched skill, or null if not found
 */
export async function fetchSkillFromRegistry(
  _slug: string,
  _config?: Partial<RegistryConfig>,
): Promise<AgentSkill | null> {
  // TODO: Implement registry fetch via HTTP or clawhub CLI wrapper
  return null;
}
