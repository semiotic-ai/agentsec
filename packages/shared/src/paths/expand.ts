/**
 * Path expansion utility used to resolve default skill-path patterns into
 * concrete absolute paths. Supports tilde, environment-variable substitution,
 * and single-level `*` globs.
 */

import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";

function substituteEnvVars(input: string): string {
  let out = input.replace(/%([^%]+)%/g, (_m, name: string) => process.env[name] ?? `%${name}%`);
  out = out.replace(/\$\{([^}]+)\}/g, (_m, name: string) => process.env[name] ?? `\${${name}}`);
  out = out.replace(
    /\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_m, name: string) => process.env[name] ?? `$${name}`,
  );
  return out;
}

function expandTilde(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return join(homedir(), input.slice(2));
  }
  return input;
}

function hasWildcard(segment: string): boolean {
  return segment.includes("*") || segment.includes("?");
}

/**
 * Convert a path segment containing `*` / `?` wildcards into a regex anchored
 * to the full segment. Other regex metacharacters are escaped so they match
 * literally.
 */
function wildcardToRegex(segment: string): RegExp {
  const escaped = segment
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\?/g, ".")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * Split a path into a starting directory and the remaining segments. The
 * starting directory is the absolute root (or `cwd` for relative inputs);
 * segments never contain separators.
 */
function splitPath(input: string): { start: string; segments: string[] } {
  const normalized = input.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((part) => part.length > 0);

  if (normalized.startsWith("/")) {
    return { start: "/", segments: parts };
  }
  // Windows drive like `C:`
  if (/^[A-Za-z]:$/.test(parts[0] ?? "")) {
    const drive = parts.shift() as string;
    return { start: `${drive}${sep}`, segments: parts };
  }
  return { start: isAbsolute(input) ? sep : process.cwd(), segments: parts };
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/**
 * Resolve remaining path segments starting from `current`. Wildcard segments
 * fan out by reading the current directory in parallel; literal segments are
 * appended without touching the filesystem.
 */
async function walk(current: string, segments: string[], index: number): Promise<string[]> {
  if (index >= segments.length) return [current];

  const segment = segments[index] as string;
  if (!hasWildcard(segment)) {
    return walk(join(current, segment), segments, index + 1);
  }

  const entries = await safeReaddir(current);
  if (entries.length === 0) return [];

  const pattern = wildcardToRegex(segment);
  const matched = entries.filter((entry) => pattern.test(entry));
  const nested = await Promise.all(
    matched.map((entry) => walk(join(current, entry), segments, index + 1)),
  );
  return nested.flat();
}

/**
 * Expand a default-skill-path pattern into a list of resolved absolute paths.
 *
 * Supports:
 * - `~` and `~/` — expands to `os.homedir()`
 * - `%VAR%` (Windows-style) and `$VAR` / `${VAR}` (POSIX-style) — expands to
 *   environment variables; unresolved variables pass through unchanged
 * - `*` and `?` globs — expanded by scanning the parent directory
 *   (single-level only; does NOT recurse into `**`)
 *
 * Returns an array of absolute resolved paths. Non-existent paths or patterns
 * that match nothing return `[]`. Never throws — errors such as permission
 * denied or ENOENT are swallowed and treated as "no match".
 *
 * @param pattern The path pattern to expand.
 * @returns A list of absolute paths. For wildcard-free patterns, the list has
 * exactly one entry and the path is not required to exist.
 */
export async function expandDefaultPath(pattern: string): Promise<string[]> {
  const expanded = expandTilde(substituteEnvVars(pattern));

  if (!hasWildcard(expanded)) {
    return [resolve(expanded)];
  }

  const { start, segments } = splitPath(expanded);
  const matches = await walk(start, segments, 0);
  return matches.map((p) => resolve(p));
}
