/**
 * Shared utility functions for scanner rules.
 *
 * These helpers are used across multiple rule files for common operations
 * like determining line numbers, extracting evidence, checking comment
 * contexts, and identifying scannable file types.
 */

/**
 * Returns the 1-based line number for a character index in a string.
 *
 * @param content - The full file content
 * @param index - The character offset to locate
 * @returns The 1-based line number containing that offset
 */
export function getLineNumber(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/**
 * Returns the trimmed text of the line containing the given character index.
 *
 * @param content - The full file content
 * @param index - The character offset whose line should be returned
 * @returns The trimmed line of source code
 */
export function getEvidenceLine(content: string, index: number): string {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  let lineEnd = content.indexOf("\n", index);
  if (lineEnd === -1) lineEnd = content.length;
  return content.slice(lineStart, lineEnd).trim();
}

/**
 * Checks whether a character index falls inside a comment.
 *
 * Supports:
 * - Single-line `//` comments (JS/TS/Go/Rust/Java/etc.)
 * - Block `/* ... *\/` comments
 * - Hash `#` comments (Python, Shell, Ruby, YAML)
 *
 * @param content - The full file content
 * @param index - The character offset to test
 * @returns `true` if the offset appears to be inside a comment
 */
export function isInComment(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineUpToMatch = content.slice(lineStart, index);

  // Single-line // comment
  if (/\/\//.test(lineUpToMatch)) return true;

  // Hash comment (Python, Shell, Ruby, YAML)
  if (/^\s*#/.test(content.slice(lineStart, index + 10))) return true;

  // Block /* ... */ comment (look back up to 500 chars)
  const before = content.slice(Math.max(0, index - 500), index);
  const lastBlockOpen = before.lastIndexOf("/*");
  const lastBlockClose = before.lastIndexOf("*/");
  if (lastBlockOpen > lastBlockClose) return true;

  return false;
}

/** Standard set of code file extensions used by most scanner rules. */
const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt",
  "sh", "bash", "zsh", "fish",
]);

/**
 * Checks whether a file extension belongs to a recognised code file type.
 *
 * Covers TypeScript, JavaScript, Python, Ruby, Go, Rust, Java, Kotlin,
 * and common shell script extensions.
 *
 * @param ext - The file extension (without the leading dot)
 * @returns `true` if the extension is a known code file type
 */
export function isCodeFile(ext: string): boolean {
  return CODE_EXTENSIONS.has(ext);
}
