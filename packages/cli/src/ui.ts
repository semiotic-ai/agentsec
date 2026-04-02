/**
 * Terminal UI utilities for agent-audit CLI.
 *
 * Provides colored output, spinner animation, progress bars,
 * and the ASCII banner used on startup.
 */

import type { AuditGrade, Severity } from "@agent-audit/shared";

// ---------------------------------------------------------------------------
// Color support
// ---------------------------------------------------------------------------

const NO_COLOR = !!process.env.NO_COLOR || Bun.argv.includes("--no-color");

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
  `    _                    _        _             _ _ _   `,
  `   / \\   __ _  ___ _ __ | |_     / \\  _   _  __| (_) |_ `,
  `  / _ \\ / _\` |/ _ \\ '_ \\| __|   / _ \\| | | |/ _\` | | __|`,
  ` / ___ \\ (_| |  __/ | | | |_   / ___ \\ |_| | (_| | | |_ `,
  `/_/   \\_\\__, |\\___|_| |_|\\__| /_/   \\_\\__,_|\\__,_|_|\\__|`,
  `        |___/                                            `,
];

export function printBanner(version: string): void {
  const gradient = [color.cyan, color.cyan, color.blue, color.blue, color.magenta, color.magenta];
  console.log();
  for (let i = 0; i < BANNER_LINES.length; i++) {
    console.log(gradient[i](BANNER_LINES[i]));
  }
  console.log(color.dim(`  Security auditing for AI agent skills  v${version}`));
  console.log();
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

export function createSpinner(message: string): Spinner {
  let frameIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let currentMessage = message;
  let stopped = false;

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
