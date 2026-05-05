/**
 * Terminal UI utilities for agentsec CLI.
 *
 * Provides colored output, spinner animation, progress bars,
 * and the ASCII banner used on startup.
 */

import { homedir } from "node:os";
import type { AgentPlatform, AuditGrade, Severity } from "@agentsec/shared";

// ---------------------------------------------------------------------------
// Color support
// ---------------------------------------------------------------------------

const NO_COLOR =
  !!process.env.NO_COLOR ||
  process.argv.includes("--no-color") ||
  // bun and node both expose argv on `process`; the legacy `Bun.argv` access
  // crashed plain-Node invocations even though the rest of the CLI requires
  // bun. Reading `process.argv` works in both runtimes.
  (typeof Bun !== "undefined" && Bun.argv?.includes("--no-color")) ||
  false;

/**
 * True when the calling environment can render ANSI control sequences. False
 * for piped output (`agentsec audit | tee log.txt`), CI logs without TTY
 * support, and when the user passed `--no-color`. Spinner / progress chrome
 * is suppressed in that case to keep stdout grep-friendly.
 */
const SUPPORTS_ANSI = !NO_COLOR && !!process.stdout.isTTY;

type ColorFn = (text: string) => string;

function esc(code: string): ColorFn {
  if (NO_COLOR) return (t) => t;
  return (t) => `\x1b[${code}m${t}\x1b[0m`;
}

export const color = {
  bold: esc("1"),
  dim: esc("2"),
  italic: esc("3"),
  underline: esc("4"),
  red: esc("31"),
  green: esc("32"),
  yellow: esc("33"),
  blue: esc("34"),
  magenta: esc("35"),
  cyan: esc("36"),
  white: esc("37"),
  gray: esc("90"),
  bgRed: esc("41"),
  bgGreen: esc("42"),
  bgYellow: esc("43"),
  bgBlue: esc("44"),
  bgMagenta: esc("45"),
} as const;

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

const BANNER_LINES = [
  `    _                    _      ____            `,
  `   / \\   __ _  ___ _ __ | |_   / ___|  ___  ___ `,
  `  / _ \\ / _\` |/ _ \\ '_ \\| __|  \\___ \\ / _ \\/ __|`,
  ` / ___ \\ (_| |  __/ | | | |_    ___) |  __/ (__ `,
  `/_/   \\_\\__, |\\___|_| |_|\\__|  |____/ \\___|\\___|`,
  `        |___/                                   `,
];

/**
 * Print the AgentSec banner to **stderr**.
 *
 * Banners are informational chrome and must not pollute stdout, which
 * is reserved for machine-consumable output (e.g. `agentsec audit
 * --format json` writes a JSON report to stdout — a banner on stdout
 * would break `JSON.parse`).
 */
export function printBanner(version: string): void {
  const gradient = [color.cyan, color.cyan, color.blue, color.blue, color.magenta, color.magenta];
  console.error();
  for (let i = 0; i < BANNER_LINES.length; i++) {
    console.error(gradient[i](BANNER_LINES[i]));
  }
  console.error(color.dim(`  Security auditing for AI agent skills  v${version}`));
  console.error();
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const _SPINNER_FRAMES = ["   ", "   ", "   ", "   ", "   ", "   ", "   ", "   "];
const BRAILLE_FRAMES = [
  "\u2801",
  "\u2803",
  "\u2807",
  "\u280f",
  "\u281f",
  "\u283f",
  "\u287f",
  "\u28ff",
  "\u28fe",
  "\u28fc",
  "\u28f8",
  "\u28f0",
  "\u28e0",
  "\u28c0",
  "\u2880",
  "\u2800",
];

export interface Spinner {
  start(): void;
  update(message: string): void;
  succeed(message: string): void;
  fail(message: string): void;
  stop(): void;
}

/**
 * A no-op spinner that silently ignores all calls. Use this when the CLI
 * is running in a machine-consumable mode (e.g. `--format json`) where any
 * output to stdout would corrupt the JSON payload.
 */
export const noopSpinner: Spinner = {
  start() {},
  update() {},
  succeed() {},
  fail() {},
  stop() {},
};

export function createSpinner(message: string): Spinner {
  // Non-TTY / no-color callers (piped to a file, CI without color support,
  // `--no-color` flag) get a degraded spinner that prints status lines but
  // skips animated frames and ANSI clear-line writes. Without this, every
  // pipe target captured `\r\x1b[K` byte sequences from the progress redraws.
  if (!SUPPORTS_ANSI) {
    let stopped = false;
    return {
      start() {
        stopped = false;
        console.log(`  ${message}`);
      },
      update(_msg: string) {
        // intentionally silent in non-TTY mode
      },
      succeed(msg: string) {
        if (stopped) return;
        stopped = true;
        console.log(`  ${msg}`);
      },
      fail(msg: string) {
        if (stopped) return;
        stopped = true;
        console.log(`  ${msg}`);
      },
      stop() {
        stopped = true;
      },
    };
  }

  let frameIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let currentMessage = message;
  let stopped = false;

  // Spinner output goes to stdout — in text mode the interactive UI IS the
  // report output. When callers need a machine-consumable mode (e.g.
  // --format json) they must use `noopSpinner` instead so nothing gets
  // written to stdout.
  function clearLine(): void {
    process.stdout.write("\r\x1b[K");
  }

  function render(): void {
    if (stopped) return;
    const frame = BRAILLE_FRAMES[frameIndex % BRAILLE_FRAMES.length];
    clearLine();
    process.stdout.write(`  ${color.cyan(frame)} ${currentMessage}`);
    frameIndex++;
  }

  return {
    start() {
      stopped = false;
      render();
      timer = setInterval(render, 80);
    },
    update(msg: string) {
      currentMessage = msg;
    },
    succeed(msg: string) {
      stopped = true;
      if (timer) clearInterval(timer);
      clearLine();
      console.log(`  ${color.green("\u2714")} ${msg}`);
    },
    fail(msg: string) {
      stopped = true;
      if (timer) clearInterval(timer);
      clearLine();
      console.log(`  ${color.red("\u2718")} ${msg}`);
    },
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      clearLine();
    },
  };
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

export function progressBar(current: number, total: number, width = 30): string {
  const ratio = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(width * ratio);
  const empty = width - filled;
  const bar = color.cyan("\u2588".repeat(filled)) + color.dim("\u2591".repeat(empty));
  const pct = `${Math.round(ratio * 100)}%`.padStart(4);
  return `  ${bar} ${pct} (${current}/${total})`;
}

// ---------------------------------------------------------------------------
// Severity / grade formatting
// ---------------------------------------------------------------------------

export function severityColor(severity: Severity): ColorFn {
  switch (severity) {
    case "critical":
      return color.bgRed;
    case "high":
      return color.red;
    case "medium":
      return color.yellow;
    case "low":
      return color.cyan;
    case "info":
      return color.dim;
  }
}

export function severityBadge(severity: Severity): string {
  const label = severity.toUpperCase().padEnd(8);
  return severityColor(severity)(` ${label} `);
}

export function gradeColor(grade: AuditGrade): ColorFn {
  switch (grade) {
    case "A":
      return color.green;
    case "B":
      return color.cyan;
    case "C":
      return color.yellow;
    case "D":
      return color.red;
    case "F":
      return color.bgRed;
  }
}

export function formatGrade(grade: AuditGrade, score: number): string {
  return gradeColor(grade)(color.bold(` ${grade} (${score}) `));
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export function divider(char = "\u2500", width = 60): string {
  return color.dim(char.repeat(width));
}

export function heading(text: string): void {
  console.log();
  console.log(color.bold(color.white(text)));
  console.log(divider());
}

export function keyValue(key: string, value: string, keyWidth = 22): void {
  console.log(`  ${color.dim(key.padEnd(keyWidth))} ${value}`);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function info(msg: string): void {
  console.log(`  ${color.blue("\u2139")} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`  ${color.yellow("\u26a0")} ${msg}`);
}

export function error(msg: string): void {
  console.log(`  ${color.red("\u2718")} ${msg}`);
}

export function success(msg: string): void {
  console.log(`  ${color.green("\u2714")} ${msg}`);
}

// ---------------------------------------------------------------------------
// Platform formatting
// ---------------------------------------------------------------------------

const HOME = homedir();

/**
 * Render an absolute path in a user-friendly short form. Replaces the
 * current user's home directory with `~` so logs read like the command
 * the user would type.
 */
export function prettyPath(absPath: string): string {
  if (!absPath) return absPath;
  if (absPath === HOME) return "~";
  if (absPath.startsWith(`${HOME}/`)) return `~/${absPath.slice(HOME.length + 1)}`;
  return absPath;
}

/** Canonical display label for each agent platform. */
export function platformLabel(platform: AgentPlatform | null | undefined): string {
  switch (platform) {
    case "claude":
      return "Claude Code";
    case "openclaw":
      return "OpenClaw";
    case "codex":
      return "Codex / skills.sh";
    default:
      return "Other";
  }
}

/** Color a platform label consistently across the CLI. */
export function platformColor(platform: AgentPlatform | null | undefined): (s: string) => string {
  switch (platform) {
    case "claude":
      return color.magenta;
    case "openclaw":
      return color.cyan;
    case "codex":
      return color.yellow;
    default:
      return color.gray;
  }
}
