import { SkillContext, SkillResult } from "@openclaw/sdk";
import { detectLanguage, normalizeLineEndings } from "./utils";

interface FormatStyle {
  indentSize: number;
  useTabs: boolean;
  maxLineLength: number;
  trailingComma: boolean;
}

const DEFAULT_STYLE: FormatStyle = {
  indentSize: 2,
  useTabs: false,
  maxLineLength: 80,
  trailingComma: true,
};

/**
 * Formats source code according to language-specific rules and style configuration.
 * Supports TypeScript, Python, and JSON with configurable indentation and line length.
 */
export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const code = ctx.input<string>("code");
  const languageHint = ctx.input<string>("language", "auto");
  const styleOverrides = ctx.input<Partial<FormatStyle>>("style", {});

  if (!code || code.trim().length === 0) {
    return ctx.error("Input code is empty or whitespace-only");
  }

  const style: FormatStyle = { ...DEFAULT_STYLE, ...styleOverrides };
  const language = languageHint === "auto" ? detectLanguage(code) : languageHint;

  ctx.log(`Formatting ${language} code with indent=${style.indentSize}`);

  const normalized = normalizeLineEndings(code);
  const formatted = formatCode(normalized, language, style);
  const changes = countChanges(normalized, formatted);

  return ctx.success({
    formatted,
    changes,
  });
}

function formatCode(code: string, language: string, style: FormatStyle): string {
  const indentChar = style.useTabs ? "\t" : " ".repeat(style.indentSize);
  const lines = code.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    let processed = normalizeIndentation(line, indentChar);
    processed = trimTrailingWhitespace(processed);

    if (processed.length > style.maxLineLength) {
      const wrapped = wrapLine(processed, style.maxLineLength, indentChar);
      result.push(...wrapped);
    } else {
      result.push(processed);
    }
  }

  if (language === "json") {
    return formatJson(result.join("\n"));
  }

  let output = result.join("\n");

  if (style.trailingComma && (language === "typescript" || language === "json")) {
    output = addTrailingCommas(output);
  }

  // Ensure file ends with a newline
  if (!output.endsWith("\n")) {
    output += "\n";
  }

  return output;
}

function normalizeIndentation(line: string, indentChar: string): string {
  const stripped = line.replace(/^[\t ]+/, "");
  if (stripped.length === 0) return "";

  const leadingWhitespace = line.match(/^[\t ]+/);
  if (!leadingWhitespace) return line;

  // Count the logical indent level
  const raw = leadingWhitespace[0];
  let level = 0;
  for (const ch of raw) {
    if (ch === "\t") {
      level += 1;
    } else {
      level += 0.5; // Two spaces = one indent level (approximate)
    }
  }

  const indentLevel = Math.round(level);
  return indentChar.repeat(indentLevel) + stripped;
}

function trimTrailingWhitespace(line: string): string {
  return line.replace(/[\t ]+$/, "");
}

function wrapLine(line: string, maxLength: number, indentChar: string): string[] {
  if (line.length <= maxLength) return [line];

  const indent = line.match(/^[\t ]*/)?.[0] ?? "";
  const content = line.slice(indent.length);
  const result: string[] = [];
  let remaining = content;

  while (remaining.length > maxLength - indent.length) {
    let breakPoint = remaining.lastIndexOf(" ", maxLength - indent.length);
    if (breakPoint <= 0) {
      breakPoint = remaining.indexOf(" ", maxLength - indent.length);
    }
    if (breakPoint <= 0) break;

    result.push(indent + remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint + 1);
  }

  if (remaining.length > 0) {
    result.push(indent + indentChar + remaining);
  }

  return result;
}

function formatJson(code: string): string {
  try {
    const parsed = JSON.parse(code);
    return JSON.stringify(parsed, null, 2) + "\n";
  } catch {
    // If it's not valid JSON, return as-is
    return code;
  }
}

function addTrailingCommas(code: string): string {
  // Add trailing commas after the last property in object/array literals
  return code.replace(
    /([^\s,{[\n])(\s*\n\s*[}\]])/g,
    "$1,$2"
  );
}

function countChanges(original: string, formatted: string): number {
  const origLines = original.split("\n");
  const fmtLines = formatted.split("\n");
  let changes = 0;

  const maxLen = Math.max(origLines.length, fmtLines.length);
  for (let i = 0; i < maxLen; i++) {
    if ((origLines[i] ?? "") !== (fmtLines[i] ?? "")) {
      changes++;
    }
  }

  return changes;
}
