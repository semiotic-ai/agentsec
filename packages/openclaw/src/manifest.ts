/**
 * Manifest file parsing for multiple formats.
 *
 * Supports:
 *   - skill.json / manifest.json  (plain JSON)
 *   - skill.yaml / skill.yml      (YAML)
 *   - SKILL.md                    (Markdown with YAML frontmatter)
 *   - package.json                (npm-style with openclaw/skill key)
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillManifest } from "@agentsec/shared";
import { parse as parseYamlDoc } from "yaml";
import {
  detectManifestFormat,
  MANIFEST_FILENAMES,
  type ManifestFormat,
  normalizeManifest,
} from "./formats";

export interface ManifestResult {
  manifest: SkillManifest;
  format: ManifestFormat;
  /** The filename that was found (e.g. "skill.json"). */
  filename: string;
  /** The raw parsed data before normalization. */
  raw: Record<string, unknown>;
}

/**
 * Attempt to locate and parse a manifest file in the given directory.
 *
 * Tries each known manifest filename in priority order. Returns the first
 * one that exists and parses successfully. Returns null if no manifest
 * is found or all candidates fail to parse.
 */
export async function findAndParseManifest(skillDir: string): Promise<ManifestResult | null> {
  for (const filename of MANIFEST_FILENAMES) {
    const filePath = join(skillDir, filename);
    try {
      const stat = await Bun.file(filePath).exists();
      if (!stat) continue;

      const content = await readFile(filePath, "utf-8");
      const format = detectManifestFormat(filename);
      if (!format) continue;

      const raw = parseManifestContent(content, format);
      if (!raw) continue;

      const manifest = normalizeManifest(raw, format);
      return { manifest, format, filename, raw };
    } catch {}
  }
  return null;
}

/**
 * Parse a specific manifest file at the given path.
 * Throws if the file cannot be read or parsed.
 */
export async function parseManifestFile(
  filePath: string,
  filename: string,
): Promise<ManifestResult> {
  const format = detectManifestFormat(filename);
  if (!format) {
    throw new Error(`Unrecognized manifest filename: ${filename}`);
  }

  const content = await readFile(filePath, "utf-8");
  const raw = parseManifestContent(content, format);
  if (!raw) {
    throw new Error(`Failed to parse manifest: ${filePath}`);
  }

  const manifest = normalizeManifest(raw, format);
  return { manifest, format, filename, raw };
}

/**
 * Parse raw manifest file content based on its format.
 * Returns null if parsing fails.
 */
function parseManifestContent(
  content: string,
  format: ManifestFormat,
): Record<string, unknown> | null {
  switch (format) {
    case "skill-json":
    case "manifest-json":
    case "package-json":
      return parseJson(content);
    case "skill-yaml":
      return parseYaml(content);
    case "skill-md":
      return parseMarkdownFrontmatter(content);
    default:
      return null;
  }
}

/** Parse JSON content, returning null on failure. */
function parseJson(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse YAML content into a plain object. Uses the standard `yaml` package
 * so we get correct handling of nested objects, mixed scalar/object/array
 * children, block scalars, anchors, and quoted strings — anything we used
 * to mis-parse with the previous hand-rolled scanner.
 *
 * Returns null for empty documents, non-object roots, or parse errors.
 */
function parseYaml(content: string): Record<string, unknown> | null {
  try {
    const parsed = parseYamlDoc(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Parse YAML frontmatter from a Markdown file.
 *
 * Expects the file to start with "---", followed by YAML, then "---".
 * Content after the frontmatter is stored as the "description" field
 * if no description is already set in the frontmatter.
 */
function parseMarkdownFrontmatter(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    // No frontmatter -- try to extract a title and use it as a minimal manifest
    return extractFromBareMarkdown(trimmed);
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    return extractFromBareMarkdown(trimmed);
  }

  const frontmatterStr = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trim();

  const result = parseYaml(frontmatterStr);
  if (!result) return null;

  // Use the markdown body as the description if none is set
  if (!result.description && body.length > 0) {
    // Strip leading headings and find the first real paragraph
    const paragraphs = body.split(/\n\s*\n/);
    const firstContent = paragraphs.find((p) => {
      const t = p.trim();
      return t.length > 0 && !t.startsWith("#");
    });
    if (firstContent) {
      result.description = firstContent.trim().slice(0, 500);
    }
  }

  return result;
}

/**
 * Attempt to extract a minimal manifest from a Markdown file that has
 * no frontmatter. Uses the first heading as the name and the first
 * paragraph as the description.
 */
function extractFromBareMarkdown(content: string): Record<string, unknown> | null {
  const lines = content.split("\n");
  let name: string | undefined;
  let description: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!name && trimmed.startsWith("# ")) {
      name = trimmed.slice(2).trim();
    } else if (name && !description && trimmed.length > 0 && !trimmed.startsWith("#")) {
      description = trimmed;
      break;
    }
  }

  if (!name) return null;

  return {
    name,
    version: "0.0.0",
    ...(description ? { description } : {}),
  };
}
