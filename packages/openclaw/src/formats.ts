/**
 * Skill format detection and normalization.
 *
 * Handles mapping file extensions to languages, identifying manifest
 * file types, and normalizing skill metadata across different formats.
 */

import type { SkillManifest, Web3ManifestBlock } from "@agentsec/shared";

/** Manifest source format as detected from filename. */
export type ManifestFormat =
  | "skill-json"
  | "skill-yaml"
  | "skill-md"
  | "package-json"
  | "manifest-json";

/** Map from file extension (without dot) to language name. */
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  rb: "ruby",
  rs: "rust",
  go: "go",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  mdx: "markdown",
  txt: "text",
  css: "css",
  html: "html",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  proto: "protobuf",
  lua: "lua",
  r: "r",
  swift: "swift",
  kt: "kotlin",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
};

/** Ordered list of filenames recognized as manifest files. */
export const MANIFEST_FILENAMES: readonly string[] = [
  "skill.json",
  "skill.yaml",
  "skill.yml",
  "SKILL.md",
  "package.json",
  "manifest.json",
] as const;

/** Files and directories that should always be skipped during tree walking. */
export const SKIP_PATTERNS: readonly string[] = [
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "venv",
  ".venv",
  ".env",
  "coverage",
  ".turbo",
  ".DS_Store",
  "Thumbs.db",
] as const;

/** Max file size we'll read (1 MB). Files larger than this are skipped. */
export const MAX_FILE_SIZE = 1_048_576;

/**
 * Detect the language of a file from its extension.
 * Returns "unknown" for unrecognized extensions.
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return "unknown";
  return EXTENSION_LANGUAGE_MAP[ext] ?? "unknown";
}

/**
 * Detect the manifest format from a filename.
 * Returns null if the filename is not a recognized manifest.
 */
export function detectManifestFormat(filename: string): ManifestFormat | null {
  const lower = filename.toLowerCase();
  if (lower === "skill.json") return "skill-json";
  if (lower === "skill.yaml" || lower === "skill.yml") return "skill-yaml";
  if (lower === "skill.md") return "skill-md";
  if (lower === "package.json") return "package-json";
  if (lower === "manifest.json") return "manifest-json";
  return null;
}

/**
 * Normalize raw manifest data from any format into a consistent SkillManifest.
 *
 * Handles differences between skill.json (direct mapping), package.json
 * (nested under "openclaw" or "skill" keys), and YAML/MD formats.
 */
export function normalizeManifest(
  raw: Record<string, unknown>,
  format: ManifestFormat,
): SkillManifest {
  if (format === "package-json") {
    return normalizeFromPackageJson(raw);
  }
  return normalizeFromDirect(raw);
}

function normalizeFromDirect(raw: Record<string, unknown>): SkillManifest {
  const hoisted = hoistOpenclawWeb3(raw);
  return {
    name: asString(raw.name, "unknown"),
    version: asString(raw.version, "0.0.0"),
    description: asOptionalString(raw.description),
    author: asOptionalString(raw.author),
    license: asOptionalString(raw.license),
    permissions: asStringArray(raw.permissions),
    dependencies: asStringRecord(raw.dependencies),
    entrypoint: asOptionalString(raw.entrypoint ?? raw.main ?? raw.entry),
    hooks: asStringRecord(raw.hooks),
    ...(hoisted ? { web3: hoisted } : {}),
    ...extractExtras(raw, [
      "name",
      "version",
      "description",
      "author",
      "license",
      "permissions",
      "dependencies",
      "entrypoint",
      "main",
      "entry",
      "hooks",
      ...(hoisted ? ["web3"] : []),
    ]),
  };
}

/**
 * Resolve the canonical Web3 manifest block.
 *
 * Skills may declare web3 capability either at the top level
 * (`web3: { ... }`) or nested under the OpenClaw metadata block
 * (`metadata.openclaw.web3: { ... }`). The latter shape matches the
 * recommendations in [docs/odos-skill-recommendations.md] and the
 * agentsec-own SKILL.md convention.
 *
 * If both are present, the top-level block wins; otherwise the
 * `metadata.openclaw.web3` block is hoisted so every downstream rule
 * can read from one canonical path (`manifest.web3.*`).
 *
 * Returns undefined when neither location declares a web3 block.
 */
function hoistOpenclawWeb3(raw: Record<string, unknown>): Web3ManifestBlock | undefined {
  const topLevel = isPlainObject(raw.web3) ? (raw.web3 as Record<string, unknown>) : undefined;
  if (topLevel) return normalizeWeb3Block(topLevel);

  const metadata = raw.metadata;
  if (!isPlainObject(metadata)) return undefined;
  const openclaw = (metadata as Record<string, unknown>).openclaw;
  if (!isPlainObject(openclaw)) return undefined;
  const nested = (openclaw as Record<string, unknown>).web3;
  if (!isPlainObject(nested)) return undefined;
  return normalizeWeb3Block(nested as Record<string, unknown>);
}

/**
 * Normalize the shape of a web3 block before it reaches downstream rules.
 *
 * The recommendations doc and the Odos manifest declare
 * `policy.allowedContracts` as a chain-keyed map
 * (`{ 1: ["0x..."], 8453: ["0x..."] }`), but `Web3ManifestBlock`
 * types it as a flat `string[]` and every consuming rule treats it
 * as one. Flatten map-shaped allowlists into a deduped flat array
 * here so each rule can read `manifest.web3.policy.allowedContracts`
 * uniformly without crashing on `.map`/`.includes`.
 */
function normalizeWeb3Block(block: Record<string, unknown>): Web3ManifestBlock {
  const policy = isPlainObject(block.policy)
    ? (block.policy as Record<string, unknown>)
    : undefined;
  if (!policy) return block as Web3ManifestBlock;

  const allowedContracts = flattenAddressMap(policy.allowedContracts);
  const allowedSelectors = flattenAddressMap(policy.allowedSelectors);

  return {
    ...block,
    policy: {
      ...policy,
      ...(allowedContracts ? { allowedContracts } : {}),
      ...(allowedSelectors ? { allowedSelectors } : {}),
    },
  } as Web3ManifestBlock;
}

/**
 * Flatten a value that may be either `string[]` or `Record<*, string[]>`
 * into a deduped `string[]`. Returns undefined for unrecognized shapes
 * so callers can omit the field entirely.
 */
function flattenAddressMap(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (isPlainObject(value)) {
    const flat: string[] = [];
    for (const entry of Object.values(value)) {
      if (Array.isArray(entry)) {
        for (const item of entry) {
          if (typeof item === "string") flat.push(item);
        }
      } else if (typeof entry === "string") {
        flat.push(entry);
      }
    }
    return Array.from(new Set(flat));
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeFromPackageJson(raw: Record<string, unknown>): SkillManifest {
  // Look for skill-specific metadata under "openclaw" or "skill" keys
  const skillMeta = (raw.openclaw ?? raw.skill ?? {}) as Record<string, unknown>;

  return {
    name: asString(skillMeta.name ?? raw.name, "unknown"),
    version: asString(skillMeta.version ?? raw.version, "0.0.0"),
    description: asOptionalString(skillMeta.description ?? raw.description),
    author: normalizeAuthor(raw.author),
    license: asOptionalString(raw.license),
    permissions: asStringArray(skillMeta.permissions),
    dependencies: asStringRecord(raw.dependencies),
    entrypoint: asOptionalString(skillMeta.entrypoint ?? skillMeta.main ?? raw.main),
    hooks: asStringRecord(skillMeta.hooks),
    ...extractExtras(skillMeta, [
      "name",
      "version",
      "description",
      "author",
      "license",
      "permissions",
      "dependencies",
      "entrypoint",
      "main",
      "hooks",
    ]),
  };
}

/** Convert author field which may be a string or { name, email } object. */
function normalizeAuthor(author: unknown): string | undefined {
  if (typeof author === "string") return author;
  if (author && typeof author === "object" && "name" in author) {
    return String((author as { name: string }).name);
  }
  return undefined;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = String(v);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extract any extra keys from the raw object that aren't in the known set.
 * These get passed through as additional manifest properties.
 */
function extractExtras(raw: Record<string, unknown>, knownKeys: string[]): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  const known = new Set(knownKeys);
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) {
      extras[key] = value;
    }
  }
  return extras;
}
