/**
 * ANSI color utilities for terminal output.
 *
 * Provides a lightweight, zero-dependency set of helpers for styling
 * CLI text with colors, backgrounds, and text decorations.  Respects
 * the NO_COLOR env var (https://no-color.org/) and non-TTY output.
 */

const isColorEnabled = (): boolean => {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  if (typeof process.stdout?.isTTY === "boolean") return process.stdout.isTTY;
  return false;
};

const wrap = (open: string, close: string) => {
  return (text: string): string => {
    if (!isColorEnabled()) return text;
    return `\x1b[${open}m${text}\x1b[${close}m`;
  };
};

// --- Text styles --------------------------------------------------------- //

export const bold = wrap("1", "22");
export const dim = wrap("2", "22");
export const italic = wrap("3", "23");
export const underline = wrap("4", "24");
export const inverse = wrap("7", "27");
export const strikethrough = wrap("9", "29");

// --- Foreground colors --------------------------------------------------- //

export const black = wrap("30", "39");
export const red = wrap("31", "39");
export const green = wrap("32", "39");
export const yellow = wrap("33", "39");
export const blue = wrap("34", "39");
export const magenta = wrap("35", "39");
export const cyan = wrap("36", "39");
export const white = wrap("37", "39");
export const gray = wrap("90", "39");

// Bright variants
export const brightRed = wrap("91", "39");
export const brightGreen = wrap("92", "39");
export const brightYellow = wrap("93", "39");
export const brightBlue = wrap("94", "39");
export const brightMagenta = wrap("95", "39");
export const brightCyan = wrap("96", "39");
export const brightWhite = wrap("97", "39");

// --- Background colors --------------------------------------------------- //

export const bgRed = wrap("41", "49");
export const bgGreen = wrap("42", "49");
export const bgYellow = wrap("43", "49");
export const bgBlue = wrap("44", "49");
export const bgMagenta = wrap("45", "49");
export const bgCyan = wrap("46", "49");
export const bgWhite = wrap("47", "49");

// --- 256-color helpers --------------------------------------------------- //

export const fg256 = (code: number) => wrap(`38;5;${code}`, "39");
export const bg256 = (code: number) => wrap(`48;5;${code}`, "49");

// --- RGB helpers --------------------------------------------------------- //

export const rgb = (r: number, g: number, b: number) => wrap(`38;2;${r};${g};${b}`, "39");
export const bgRgb = (r: number, g: number, b: number) => wrap(`48;2;${r};${g};${b}`, "49");

// --- Brand colors -------------------------------------------------------- //

/** Teal accent used for the AgentSec brand */
export const teal = rgb(0, 210, 180);
/** Background teal */
export const bgTeal = bgRgb(0, 210, 180);

// --- Severity colors ----------------------------------------------------- //

import type { Severity } from "@agentsec/shared";

export const severityColor = (severity: Severity): ((text: string) => string) => {
  switch (severity) {
    case "critical":
      return brightRed;
    case "high":
      return yellow;
    case "medium":
      return fg256(208); // orange
    case "low":
      return blue;
    case "info":
      return gray;
  }
};

export const severityBg = (severity: Severity): ((text: string) => string) => {
  switch (severity) {
    case "critical":
      return bgRed;
    case "high":
      return bgYellow;
    case "medium":
      return bg256(208);
    case "low":
      return bgBlue;
    case "info":
      return (t: string) => t;
  }
};

// --- Grade colors -------------------------------------------------------- //

import type { AuditGrade } from "@agentsec/shared";

export const gradeColor = (grade: AuditGrade): ((text: string) => string) => {
  switch (grade) {
    case "A":
      return brightGreen;
    case "B":
      return green;
    case "C":
      return yellow;
    case "D":
      return fg256(208);
    case "F":
      return brightRed;
  }
};

// --- Utility ------------------------------------------------------------- //

/** Strip all ANSI escape sequences from a string. */
export const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

/** Visible length of a string (ignoring ANSI codes). */
export const visibleLength = (text: string): number => stripAnsi(text).length;

/** Pad a string to `width` visible characters, ignoring ANSI codes. */
export const padEnd = (text: string, width: number): string => {
  const pad = width - visibleLength(text);
  return pad > 0 ? text + " ".repeat(pad) : text;
};

/** Pad a string to `width` visible characters (right-aligned). */
export const padStart = (text: string, width: number): string => {
  const pad = width - visibleLength(text);
  return pad > 0 ? " ".repeat(pad) + text : text;
};

/** Center a string within `width` visible characters. */
export const center = (text: string, width: number): string => {
  const pad = width - visibleLength(text);
  if (pad <= 0) return text;
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + text + " ".repeat(right);
};

// --- Unicode symbols ----------------------------------------------------- //

export const symbols = {
  check: "\u2713",
  cross: "\u2717",
  warning: "\u26A0",
  info: "\u2139",
  bullet: "\u2022",
  arrowRight: "\u2192",
  arrowDown: "\u2193",
  ellipsis: "\u2026",
  shield: "\u26E8",
  lock: "\uD83D\uDD12",
  star: "\u2605",
  emptyCircle: "\u25CB",
  filledCircle: "\u25CF",
  halfCircle: "\u25D0",
} as const;

// --- Box drawing --------------------------------------------------------- //

export const box = {
  topLeft: "\u250C",
  topRight: "\u2510",
  bottomLeft: "\u2514",
  bottomRight: "\u2518",
  horizontal: "\u2500",
  vertical: "\u2502",
  teeRight: "\u251C",
  teeLeft: "\u2524",
  teeDown: "\u252C",
  teeUp: "\u2534",
  cross: "\u253C",
  // Heavy variants
  heavyHorizontal: "\u2501",
  heavyVertical: "\u2503",
  heavyTopLeft: "\u250F",
  heavyTopRight: "\u2513",
  heavyBottomLeft: "\u2517",
  heavyBottomRight: "\u251B",
  // Rounded
  roundTopLeft: "\u256D",
  roundTopRight: "\u256E",
  roundBottomLeft: "\u2570",
  roundBottomRight: "\u256F",
} as const;

// --- Progress bar -------------------------------------------------------- //

export const progressBar = (value: number, max: number, width: number = 20): string => {
  const ratio = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  const color =
    ratio >= 0.8
      ? brightGreen
      : ratio >= 0.6
        ? green
        : ratio >= 0.4
          ? yellow
          : ratio >= 0.2
            ? fg256(208)
            : brightRed;

  const filledStr = color("\u2588".repeat(filled));
  const emptyStr = dim("\u2591".repeat(empty));

  return `${filledStr}${emptyStr}`;
};

/** Render a score gauge like:  [||||||||      ] 72/100 */
export const scoreGauge = (score: number, width: number = 20): string => {
  const bar = progressBar(score, 100, width);
  const label = padStart(`${score}`, 3);
  return `${bar} ${dim(`${label}/100`)}`;
};
