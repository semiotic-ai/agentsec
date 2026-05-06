import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { PolicyConfig } from "@agentsec/shared";
import { getPreset } from "./presets";

/**
 * Load a policy configuration from a JSON or YAML file.
 *
 * Supports:
 *  - .json files parsed with JSON.parse
 *  - .yml / .yaml files parsed with a simple YAML subset parser
 *  - Preset references: if the file content has a top-level "preset" key,
 *    the corresponding built-in preset is returned instead.
 */
export async function loadPolicyFile(filePath: string): Promise<PolicyConfig> {
  const raw = await readFile(filePath, "utf-8");
  const ext = extname(filePath).toLowerCase();

  let parsed: unknown;

  if (ext === ".json") {
    parsed = JSON.parse(raw);
  } else if (ext === ".yml" || ext === ".yaml") {
    parsed = parseSimpleYaml(raw);
  } else {
    throw new Error(`Unsupported policy file extension "${ext}". Use .json, .yml, or .yaml.`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Policy file "${filePath}" did not parse to an object`);
  }

  const obj = parsed as Record<string, unknown>;

  // Support preset reference: { "preset": "strict" }
  if (typeof obj.preset === "string") {
    const preset = getPreset(obj.preset);
    if (!preset) {
      throw new Error(`Unknown policy preset: "${obj.preset}"`);
    }
    return preset;
  }

  // Validate minimum shape
  if (typeof obj.name !== "string") {
    throw new Error(`Policy file must have a "name" field or a "preset" reference`);
  }

  if (!Array.isArray(obj.rules)) {
    throw new Error(`Policy file must have a "rules" array`);
  }

  return obj as unknown as PolicyConfig;
}

/**
 * Parse a JSON string as a policy config (useful for inline / API usage).
 */
export function parsePolicyJson(json: string): PolicyConfig {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Policy JSON did not parse to an object");
  }
  if (typeof parsed.preset === "string") {
    const preset = getPreset(parsed.preset);
    if (!preset) {
      throw new Error(`Unknown policy preset: "${parsed.preset}"`);
    }
    return preset;
  }
  if (typeof parsed.name !== "string" || !Array.isArray(parsed.rules)) {
    throw new Error("Policy JSON must have a 'name' string and 'rules' array");
  }
  return parsed as PolicyConfig;
}

// ---------------------------------------------------------------------------
// Minimal YAML parser
// ---------------------------------------------------------------------------
// This handles the subset of YAML we need for policy files:
// key-value pairs, arrays (both inline and block), nested objects.
// For production use with complex YAML, consider adding a full parser.

function parseSimpleYaml(raw: string): Record<string, unknown> {
  const lines = raw.split("\n");
  const result: Record<string, unknown> = {};
  let i = 0;

  function getIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  function parseValue(val: string): unknown {
    const trimmed = val.trim();
    if (trimmed === "" || trimmed === "~" || trimmed === "null") return null;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    // Inline array: [a, b, c]
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inner = trimmed.slice(1, -1);
      if (inner.trim() === "") return [];
      return inner.split(",").map((s) => parseValue(s));
    }

    // Strip quotes
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  }

  function parseBlock(baseIndent: number): Record<string, unknown> | unknown[] {
    // Peek to see if this is a list or map
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        i++;
        continue;
      }
      break;
    }

    if (i >= lines.length) return {};

    const firstLine = lines[i].trim();
    if (firstLine.startsWith("- ")) {
      return parseArray(baseIndent);
    }
    return parseMap(baseIndent);
  }

  function parseMap(baseIndent: number): Record<string, unknown> {
    const map: Record<string, unknown> = {};

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (trimmed === "" || trimmed.startsWith("#")) {
        i++;
        continue;
      }

      const indent = getIndent(line);
      if (indent < baseIndent) break;
      if (indent > baseIndent) break; // shouldn't happen at map level

      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) {
        i++;
        continue;
      }

      const key = trimmed.slice(0, colonIdx).trim();
      const valueStr = trimmed.slice(colonIdx + 1).trim();
      i++;

      if (valueStr === "") {
        // Nested block
        const nextNonEmpty = peekNextNonEmptyIndent();
        if (nextNonEmpty > indent) {
          map[key] = parseBlock(nextNonEmpty);
        } else {
          map[key] = null;
        }
      } else {
        map[key] = parseValue(valueStr);
      }
    }

    return map;
  }

  function parseArray(baseIndent: number): unknown[] {
    const arr: unknown[] = [];

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "" || trimmed.startsWith("#")) {
        i++;
        continue;
      }

      const indent = getIndent(line);
      if (indent < baseIndent) break;

      if (trimmed.startsWith("- ")) {
        const valueStr = trimmed.slice(2).trim();
        const colonIdx = valueStr.indexOf(":");

        if (colonIdx !== -1) {
          // Array of objects: first key is on the same line as the dash
          const key = valueStr.slice(0, colonIdx).trim();
          const val = valueStr.slice(colonIdx + 1).trim();
          i++;
          const obj: Record<string, unknown> = {};
          obj[key] = val === "" ? null : parseValue(val);

          // Collect remaining keys of this object (indented further)
          const nextNonEmpty = peekNextNonEmptyIndent();
          if (nextNonEmpty > indent) {
            const more = parseMap(nextNonEmpty);
            Object.assign(obj, more);
          }

          arr.push(obj);
        } else {
          arr.push(parseValue(valueStr));
          i++;
        }
      } else {
        break;
      }
    }

    return arr;
  }

  function peekNextNonEmptyIndent(): number {
    for (let j = i; j < lines.length; j++) {
      const trimmed = lines[j].trim();
      if (trimmed !== "" && !trimmed.startsWith("#")) {
        return getIndent(lines[j]);
      }
    }
    return 0;
  }

  // Start parsing from the top level
  const topLevel = parseMap(0);
  Object.assign(result, topLevel);
  return result;
}
