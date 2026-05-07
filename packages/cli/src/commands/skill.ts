/**
 * Skill command — fuzzy-match a single discovered skill by name or folder
 * and run a verbose audit against it.
 *
 * Usage:
 *   agentsec skill <query>
 *
 * Matching is case-insensitive and tolerant of shortened or misspelled
 * names. The query is scored against each discovered skill's manifest
 * `name` and folder basename; the higher of the two wins. Tiers (best
 * to worst):
 *
 *   1. Exact match (1000)
 *   2. Prefix match
 *   3. Substring match
 *   4. Subsequence match (handles shortened forms like "w01sign" → "w01-signing-vuln-skill")
 *   5. Levenshtein within tolerance (handles typos)
 *
 * If no match is found, or several skills tie for best, the command lists
 * candidates and exits non-zero so the user can refine the query.
 */

import { basename } from "node:path";
import type { AgentSkill } from "@agentsec/shared";
import type { AuditConfig } from "../config";
import { color, error, info } from "../ui";
import { runAudit } from "./audit";

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

interface SkillMatch {
  skill: AgentSkill;
  score: number;
  matchedOn: "name" | "folder";
  candidate: string;
}

/** True when `needle` characters appear in `haystack` in order (gaps allowed). */
function isSubsequence(needle: string, haystack: string): boolean {
  if (needle.length === 0) return true;
  if (needle.length > haystack.length) return false;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** Standard Levenshtein distance with O(min(a,b)) memory. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Keep `a` as the shorter string so the row stays small.
  if (a.length > b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  let prev = new Array(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    const curr = new Array(a.length + 1);
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(curr[i - 1] + 1, prev[i] + 1, prev[i - 1] + cost);
    }
    prev = curr;
  }
  return prev[a.length];
}

/**
 * Score `query` against `candidate`. Returns -1 for "no match". Higher is
 * better; ties are broken by the relative size of the matched portion so
 * "w01" matching "w01-foo" beats "w01" matching "w01-foo-bar-baz".
 */
function scoreMatch(query: string, candidate: string): number {
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();
  if (q.length === 0 || c.length === 0) return -1;

  if (q === c) return 1000;
  if (c.startsWith(q)) return 800 + Math.round((q.length / c.length) * 100);

  const idx = c.indexOf(q);
  if (idx !== -1) {
    // Earlier matches win; shorter haystack relative to needle wins.
    return 600 + Math.round((q.length / c.length) * 100) - Math.min(idx, 50);
  }

  if (isSubsequence(q, c)) {
    return 400 + Math.round((q.length / c.length) * 100);
  }

  // Typo tolerance scales with candidate length so a 3-char typo on a
  // 30-char skill name is still a viable hit but a 3-char typo on a
  // 5-char query is not.
  const tolerance = Math.max(1, Math.floor(c.length / 3));
  const dist = levenshtein(q, c);
  if (dist <= tolerance) return 200 - dist * 10;

  return -1;
}

/**
 * Find every skill that scored above zero against `query`, sorted by score
 * (best first). Both the manifest name and the folder basename participate
 * in the score; whichever is higher decides the skill's overall score.
 */
export function rankSkills(skills: AgentSkill[], query: string): SkillMatch[] {
  const out: SkillMatch[] = [];
  for (const skill of skills) {
    const folder = basename(skill.path);
    const nameScore = scoreMatch(query, skill.name);
    const folderScore = scoreMatch(query, folder);
    const best = Math.max(nameScore, folderScore);
    if (best <= 0) continue;
    const matchedOn: "name" | "folder" = nameScore >= folderScore ? "name" : "folder";
    out.push({
      skill,
      score: best,
      matchedOn,
      candidate: matchedOn === "name" ? skill.name : folder,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// ---------------------------------------------------------------------------
// Discovery (mirrors audit.ts so the same skills are searchable)
// ---------------------------------------------------------------------------

async function discoverAllSkills(config: AuditConfig): Promise<AgentSkill[]> {
  try {
    const openclaw = await import("@agentsec/openclaw");
    const SkillDiscovery = openclaw.SkillDiscovery ?? openclaw.default?.SkillDiscovery;

    if (config.path) {
      // Honor `--path` so users can scope the search. Try as a single skill
      // first, then as a parent of many skills.
      if (typeof SkillDiscovery === "function") {
        const discovery = new SkillDiscovery();
        const single = await discovery.parseSkill(config.path);
        if (single) return [single];
        return await discovery.scanDirectory(config.path);
      }
      return [];
    }

    // Default: full cross-platform auto-discovery.
    const discoverAll = openclaw.discoverAll ?? openclaw.default?.discoverAll;
    if (typeof discoverAll === "function") return await discoverAll();

    if (typeof SkillDiscovery === "function") {
      const discovery = new SkillDiscovery();
      return await discovery.discover(config.platform);
    }
  } catch {
    // Package not built — degrade to empty list.
  }
  return [];
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function printCandidateList(matches: SkillMatch[], limit: number): void {
  for (const m of matches.slice(0, limit)) {
    const folder = basename(m.skill.path);
    const tag =
      m.matchedOn === "folder" ? color.dim(`(folder: ${folder})`) : color.dim(`(${folder})`);
    console.log(`  ${color.cyan(m.skill.name)} ${tag}`);
  }
}

function printAvailableHint(skills: AgentSkill[], limit: number): void {
  info("Available skills:");
  for (const skill of skills.slice(0, limit)) {
    console.log(`  ${color.cyan(skill.name)} ${color.dim(`(${basename(skill.path)})`)}`);
  }
  if (skills.length > limit) {
    console.log(color.dim(`  … and ${skills.length - limit} more`));
  }
}

// ---------------------------------------------------------------------------
// Command entry
// ---------------------------------------------------------------------------

export async function runSkill(config: AuditConfig, args: string[]): Promise<number> {
  const query = args[0]?.trim();
  if (!query) {
    error("Missing skill name");
    info("Usage: agentsec skill <name-or-folder>");
    info("Searches every discovered skill (Claude/OpenClaw/Codex) for a fuzzy match");
    info("and runs a verbose audit on the best hit.");
    return 1;
  }

  const skills = await discoverAllSkills(config);
  if (skills.length === 0) {
    error("No skills found");
    if (config.path) {
      info(`Looked under ${color.bold(config.path)}`);
    } else {
      info("Searched default Claude / OpenClaw / Codex locations");
      info("Use --path <dir> to scan a custom location");
    }
    return 1;
  }

  const matches = rankSkills(skills, query);

  if (matches.length === 0) {
    error(`No skill matched '${query}'`);
    printAvailableHint(skills, 10);
    return 1;
  }

  // The top match wins outright when it's exact, or when the gap to the
  // runner-up is wide enough that the choice is unambiguous. Otherwise we
  // surface the candidates so the user can refine.
  const top = matches[0];
  const second = matches[1];
  const dominant = !second || top.score >= 1000 || top.score - second.score >= 100;

  if (!dominant) {
    info(`Multiple skills matched '${query}':`);
    printCandidateList(matches, 5);
    info("Refine the query (try the full folder name) or pass --path to narrow the search.");
    return 1;
  }

  info(
    `Auditing ${color.bold(top.skill.name)} ${color.dim(`(${basename(top.skill.path)})`)}` +
      ` — matched on ${top.matchedOn}`,
  );

  // Re-enter the audit pipeline pointed at this single skill, with verbose
  // forced on. The audit command's `--path` already accepts a single skill
  // directory (parseSkill fallback in commands/audit.ts), so this just works.
  return runAudit({
    ...config,
    path: top.skill.path,
    verbose: true,
  });
}
