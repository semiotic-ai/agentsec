/**
 * File tree walker that respects .gitignore patterns and skips
 * common non-source directories like node_modules.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SkillFile } from "@agent-audit/shared";
import { detectLanguage, MAX_FILE_SIZE, SKIP_PATTERNS } from "./formats";

/**
 * Parsed .gitignore rules. Each rule has a pattern and whether it's negated.
 */
interface IgnoreRule {
  pattern: string;
  negated: boolean;
  /** True if the pattern should only match directories. */
  directoryOnly: boolean;
}

/**
 * Walk a skill directory and collect all source files.
 *
 * Respects .gitignore at the root of the skill directory (if present),
 * and always skips common non-source directories (node_modules, .git, etc.).
 *
 * @param rootDir - Absolute path to the skill directory root
 * @returns Array of SkillFile objects with content and metadata
 */
export async function walkSkillDirectory(rootDir: string): Promise<SkillFile[]> {
  const ignoreRules = await loadGitignore(rootDir);
  const files: SkillFile[] = [];

  await walkDirectory(rootDir, rootDir, ignoreRules, files);

  return files;
}

async function walkDirectory(
  rootDir: string,
  currentDir: string,
  ignoreRules: IgnoreRule[],
  results: SkillFile[],
): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = (await readdir(currentDir, { withFileTypes: true })) as import("node:fs").Dirent[];
  } catch {
    // Directory unreadable -- skip silently
    return;
  }

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    const relPath = relative(rootDir, fullPath);

    // Always skip well-known non-source directories and files
    if (SKIP_PATTERNS.includes(entry.name)) {
      continue;
    }

    // Check .gitignore rules
    if (isIgnored(relPath, entry.isDirectory(), ignoreRules)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkDirectory(rootDir, fullPath, ignoreRules, results);
    } else if (entry.isFile()) {
      const file = await readSkillFile(fullPath, rootDir);
      if (file) {
        results.push(file);
      }
    }
  }
}

/**
 * Read a single file and return a SkillFile object.
 * Returns null if the file is too large, binary, or unreadable.
 */
async function readSkillFile(filePath: string, rootDir: string): Promise<SkillFile | null> {
  try {
    const fileStat = await stat(filePath);

    // Skip files that are too large
    if (fileStat.size > MAX_FILE_SIZE) {
      return null;
    }

    // Skip empty files
    if (fileStat.size === 0) {
      return null;
    }

    const content = await readFile(filePath, "utf-8");

    // Heuristic: skip likely-binary files (NUL bytes in first 8KB)
    const sample = content.slice(0, 8192);
    if (sample.includes("\0")) {
      return null;
    }

    const relPath = relative(rootDir, filePath);
    const language = detectLanguage(filePath);

    return {
      path: filePath,
      relativePath: relPath,
      content,
      language,
      size: fileStat.size,
    };
  } catch {
    return null;
  }
}

/**
 * Load and parse a .gitignore file from the root of a skill directory.
 * Returns an empty array if no .gitignore is found.
 */
async function loadGitignore(rootDir: string): Promise<IgnoreRule[]> {
  try {
    const content = await readFile(join(rootDir, ".gitignore"), "utf-8");
    return parseGitignore(content);
  } catch {
    return [];
  }
}

/**
 * Parse .gitignore content into a list of rules.
 */
function parseGitignore(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];

  for (const rawLine of content.split("\n")) {
    let line = rawLine.trim();

    // Skip empty lines and comments
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    let negated = false;
    if (line.startsWith("!")) {
      negated = true;
      line = line.slice(1);
    }

    // Remove trailing spaces (unless escaped)
    line = line.replace(/(?<!\\)\s+$/, "");
    if (line === "") continue;

    let directoryOnly = false;
    if (line.endsWith("/")) {
      directoryOnly = true;
      line = line.slice(0, -1);
    }

    // Remove leading slash (anchors to root, but we match relative paths)
    if (line.startsWith("/")) {
      line = line.slice(1);
    }

    rules.push({ pattern: line, negated, directoryOnly });
  }

  return rules;
}

/**
 * Check whether a relative path should be ignored based on .gitignore rules.
 *
 * Uses simplified gitignore matching: glob patterns with * and ** support.
 */
function isIgnored(relPath: string, isDirectory: boolean, rules: IgnoreRule[]): boolean {
  let ignored = false;

  for (const rule of rules) {
    // Directory-only rules don't apply to files
    if (rule.directoryOnly && !isDirectory) {
      continue;
    }

    if (matchesPattern(relPath, rule.pattern)) {
      ignored = !rule.negated;
    }
  }

  return ignored;
}

/**
 * Test whether a relative path matches a gitignore-style glob pattern.
 *
 * Supports:
 *   - "*" matches anything except "/"
 *   - "**" matches any number of directories
 *   - "?" matches a single character except "/"
 *   - Patterns without "/" match against the basename
 *   - Patterns with "/" match against the full relative path
 */
function matchesPattern(relPath: string, pattern: string): boolean {
  // If the pattern doesn't contain a slash, match against the basename
  // and any path segment
  if (!pattern.includes("/")) {
    const segments = relPath.split("/");
    return segments.some((segment) => globMatch(segment, pattern));
  }

  // Pattern contains a slash -- match against the full relative path
  return globMatch(relPath, pattern);
}

/**
 * Simple glob matcher supporting *, **, and ? wildcards.
 * Converts the glob pattern to a regex for matching.
 */
function globMatch(text: string, pattern: string): boolean {
  let regex = "^";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // "**" matches any number of path segments
        if (pattern[i + 2] === "/") {
          regex += "(?:.+/)?";
          i += 3;
        } else {
          regex += ".*";
          i += 2;
        }
      } else {
        // "*" matches anything except "/"
        regex += "[^/]*";
        i += 1;
      }
    } else if (ch === "?") {
      regex += "[^/]";
      i += 1;
    } else if (ch === ".") {
      regex += "\\.";
      i += 1;
    } else if (ch === "[") {
      // Pass through character classes
      const close = pattern.indexOf("]", i);
      if (close !== -1) {
        regex += pattern.slice(i, close + 1);
        i = close + 1;
      } else {
        regex += "\\[";
        i += 1;
      }
    } else {
      regex += ch === "\\" ? "\\\\" : ch;
      i += 1;
    }
  }

  regex += "$";

  try {
    return new RegExp(regex).test(text);
  } catch {
    return false;
  }
}
