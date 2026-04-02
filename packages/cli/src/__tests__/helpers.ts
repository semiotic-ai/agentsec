/**
 * Shared test helpers for CLI tests.
 */

/** Builds an argv array as Bun.argv would provide it (bunPath, scriptPath, ...userArgs). */
export function argv(...userArgs: string[]): string[] {
  return ["/usr/bin/bun", "/cli.ts", ...userArgs];
}
