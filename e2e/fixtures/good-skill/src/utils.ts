/**
 * Detects the programming language of a code snippet using simple heuristics.
 */
export function detectLanguage(code: string): string {
  const trimmed = code.trim();

  // JSON detection: starts with { or [
  if (/^\s*[\[{]/.test(trimmed) && isValidJson(trimmed)) {
    return "json";
  }

  // TypeScript detection
  const tsIndicators = [
    /\binterface\s+\w+/,
    /\btype\s+\w+=>/,
    /:\s*(string|number|boolean|void|any|unknown|never)\b/,
    /\bimport\s+.*\s+from\s+['"].*['"]/,
    /\bexport\s+(default\s+)?(function|class|const|interface|type)\b/,
    /\bconst\s+\w+\s*:\s*\w+/,
    /<\w+(\s*,\s*\w+)*>/,
  ];

  const tsScore = tsIndicators.reduce(
    (score, pattern) => score + (pattern.test(code) ? 1 : 0),
    0
  );

  // Python detection
  const pyIndicators = [
    /\bdef\s+\w+\s*\(/,
    /\bclass\s+\w+(\(.*\))?:/,
    /\bimport\s+\w+/,
    /\bfrom\s+\w+\s+import\b/,
    /\bif\s+__name__\s*==\s*['"]__main__['"]\s*:/,
    /\bself\.\w+/,
    /\bprint\s*\(/,
  ];

  const pyScore = pyIndicators.reduce(
    (score, pattern) => score + (pattern.test(code) ? 1 : 0),
    0
  );

  if (tsScore > pyScore && tsScore >= 2) return "typescript";
  if (pyScore > tsScore && pyScore >= 2) return "python";

  // Default to typescript if no strong signal
  return "typescript";
}

/**
 * Normalizes line endings to LF (\n).
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
