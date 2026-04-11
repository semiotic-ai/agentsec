"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/** The shell command typed at the top of the animation. */
const COMMAND = "$ npx AgentSec";

/** Characters per second for the initial command typing animation. */
const TYPING_CHARS_PER_SEC = 28;

/** Delay between streamed output lines, in milliseconds. */
const LINE_DELAY_MS = 110;

/** Delay after the command is typed before output starts streaming. */
const POST_COMMAND_DELAY_MS = 260;

/** Duration of the per-skill progress bar fill animation, in milliseconds. */
const PROGRESS_BAR_MS = 360;

/** Total width (in cells) of the rendered progress bar. */
const PROGRESS_BAR_WIDTH = 18;

/** IntersectionObserver threshold for kicking off the animation. */
const VISIBILITY_THRESHOLD = 0.1;

/** One of the grade badge color tiers. */
type GradeTier = "good" | "warn" | "bad";

interface ScannedSkill {
  name: string;
  version: string;
  grade: string;
  score: number;
  tier: GradeTier;
}

const SKILLS: readonly ScannedSkill[] = [
  { name: "helpful-summarizer", version: "v1.2.0", grade: "F", score: 30, tier: "bad" },
  { name: "note-taker", version: "v2.0.0", grade: "F", score: 30, tier: "bad" },
  { name: "template-renderer", version: "v0.8.3", grade: "F", score: 30, tier: "bad" },
  { name: "markdown-previewer", version: "v2.1.0", grade: "F", score: 30, tier: "bad" },
  { name: "i18n-translator", version: "v3.2.1", grade: "F", score: 30, tier: "bad" },
  { name: "git-changelog", version: "v1.5.2", grade: "F", score: 30, tier: "bad" },
  { name: "csv-analyzer", version: "v1.0.0", grade: "C", score: 62, tier: "warn" },
  { name: "code-formatter", version: "v1.2.0", grade: "D", score: 56, tier: "bad" },
] as const;

/** Classes for the rounded grade badge next to a skill name. */
function gradeBadgeClass(tier: GradeTier): string {
  switch (tier) {
    case "good":
      return "text-brand-green";
    case "warn":
      return "text-brand-yellow";
    case "bad":
      return "bg-brand-red/90 text-brand-text px-1.5 rounded";
  }
}

/** Render a progress bar as filled + empty cells. */
function progressBarCells(filled: number, total: number): { filled: string; empty: string } {
  const filledCount = Math.max(0, Math.min(total, filled));
  return {
    filled: "\u2588".repeat(filledCount),
    empty: "\u2591".repeat(total - filledCount),
  };
}

/**
 * Scroll-triggered animated terminal that types `$ npx AgentSec` then streams
 * a full audit run against the bundled fixtures. Honors `prefers-reduced-motion`
 * by rendering the whole output immediately when reduced motion is requested.
 * Uses a single `IntersectionObserver` to kick off the animation the first time
 * the terminal enters the viewport. All timers and the observer are cleaned up
 * on unmount.
 */
const FULL_BAR = "\u2588".repeat(PROGRESS_BAR_WIDTH);

export function AnimatedTerminal(): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const rafRef = useRef<number | null>(null);

  const [typedLength, setTypedLength] = useState(0);
  const [revealedSkills, setRevealedSkills] = useState(0);
  const [progressFill, setProgressFill] = useState(0);
  const [summaryShown, setSummaryShown] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [started, setStarted] = useState(false);
  const [caretOn, setCaretOn] = useState(true);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const timeouts = timeoutsRef.current;
    const clearAllTimers = (): void => {
      for (const handle of timeouts) clearTimeout(handle);
      timeouts.clear();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    if (prefersReducedMotion) {
      setTypedLength(COMMAND.length);
      setRevealedSkills(SKILLS.length);
      setProgressFill(PROGRESS_BAR_WIDTH);
      setSummaryShown(true);
      setShowCursor(false);
      setStarted(true);
      return clearAllTimers;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD) {
            setStarted(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: VISIBILITY_THRESHOLD },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      clearAllTimers();
    };
  }, []);

  // Drive the full typing + streaming animation as a single sequenced script
  // kicked off when `started` flips true. Keeping it in one effect avoids
  // stale-closure deps and makes cleanup trivial.
  useEffect(() => {
    if (!started) return;

    let cancelled = false;
    const timeouts = timeoutsRef.current;
    const scheduleTimeout = (fn: () => void, delayMs: number): void => {
      const handle = setTimeout(() => {
        timeouts.delete(handle);
        if (!cancelled) fn();
      }, delayMs);
      timeouts.add(handle);
    };
    const scheduleRaf = (fn: FrameRequestCallback): void => {
      rafRef.current = requestAnimationFrame((t) => {
        rafRef.current = null;
        if (!cancelled) fn(t);
      });
    };

    const perCharMs = Math.round(1000 / TYPING_CHARS_PER_SEC);

    const typeCommand = (index: number): void => {
      if (index >= COMMAND.length) {
        scheduleTimeout(() => streamSkill(0), POST_COMMAND_DELAY_MS);
        return;
      }
      setTypedLength(index + 1);
      scheduleTimeout(() => typeCommand(index + 1), perCharMs);
    };

    const streamSkill = (completed: number): void => {
      if (completed >= SKILLS.length) {
        scheduleTimeout(() => {
          setSummaryShown(true);
          setShowCursor(false);
        }, LINE_DELAY_MS * 2);
        return;
      }
      const nextCount = completed + 1;
      const prevCells = Math.round((completed / SKILLS.length) * PROGRESS_BAR_WIDTH);
      const targetCells = Math.round((nextCount / SKILLS.length) * PROGRESS_BAR_WIDTH);
      setProgressFill(prevCells);
      setRevealedSkills(nextCount);
      const start = performance.now();
      const step: FrameRequestCallback = (now) => {
        const t = Math.min(1, (now - start) / PROGRESS_BAR_MS);
        setProgressFill(Math.round(prevCells + (targetCells - prevCells) * t));
        if (t < 1) {
          scheduleRaf(step);
          return;
        }
        scheduleTimeout(() => streamSkill(nextCount), LINE_DELAY_MS);
      };
      scheduleRaf(step);
    };

    typeCommand(0);

    return () => {
      cancelled = true;
    };
  }, [started]);

  useEffect(() => {
    if (!showCursor) {
      setCaretOn(false);
      return;
    }
    const id = setInterval(() => setCaretOn((v) => !v), 520);
    return () => clearInterval(id);
  }, [showCursor]);

  const typedCommand = COMMAND.slice(0, typedLength);
  const commandFinished = typedLength >= COMMAND.length;
  const visibleSkills = SKILLS.slice(0, revealedSkills);
  const bar = progressBarCells(progressFill, PROGRESS_BAR_WIDTH);
  const percent = revealedSkills === 0 ? 0 : Math.round((revealedSkills / SKILLS.length) * 100);
  const runFinished = revealedSkills >= SKILLS.length;

  return (
    <section id="cli" className="bg-brand-dark pt-4 pb-20 md:pb-24">
      <div className="max-w-3xl mx-auto px-6">
        <div
          ref={containerRef}
          className="rounded-lg border border-brand-border bg-brand-secondary overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        >
          {/* Title bar */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-brand-border bg-brand-card">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" aria-hidden="true" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" aria-hidden="true" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" aria-hidden="true" />
            <span className="flex-1 text-center text-xs text-brand-muted font-mono select-none">
              agentsec — /dot open claw
            </span>
            <span className="w-[42px]" aria-hidden="true" />
          </div>
          {/* Body */}
          <div
            role="img"
            aria-label="Animated terminal showing an AgentSec audit run against 8 skills"
            className="font-mono text-sm md:text-[13px] leading-relaxed text-brand-text whitespace-pre overflow-x-auto px-6 py-5 min-h-[280px]"
          >
            {/* Command line */}
            <div>
              <span className="text-brand-muted">{typedCommand.slice(0, 2)}</span>
              <span className="text-brand-teal">{typedCommand.slice(2)}</span>
              {showCursor && !commandFinished && (
                <span
                  aria-hidden="true"
                  className={caretOn ? "text-brand-teal" : "text-transparent"}
                >
                  {"\u258C"}
                </span>
              )}
            </div>

            {commandFinished && (
              <>
                <div>&nbsp;</div>
                <div>
                  {"  "}
                  <span className="text-brand-green">{"\u2714"}</span> Found 8 skills
                </div>
                <div>&nbsp;</div>
                <div>Scanning Skills</div>
                <div className="text-brand-border">{"\u2500".repeat(40)}</div>
                {visibleSkills.map((skill, i) => {
                  const isCurrentStreaming = i === revealedSkills - 1 && !runFinished;
                  return (
                    <div key={skill.name}>
                      <div>
                        {"  "}
                        <span className="text-brand-green">{"\u2714"}</span>{" "}
                        <span className="text-brand-text">{skill.name}</span>{" "}
                        <span className="text-brand-muted">{skill.version}</span>
                        {"  "}
                        <span className={gradeBadgeClass(skill.tier)}>
                          {skill.grade} ({skill.score})
                        </span>
                      </div>
                      {isCurrentStreaming && (
                        <div>
                          {"  "}
                          <span className="text-brand-teal">{bar.filled}</span>
                          <span className="text-brand-muted">{bar.empty}</span>
                          <span className="text-brand-muted">
                            {"  "}
                            {percent}% ({revealedSkills}/{SKILLS.length})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {runFinished && (
                  <div>
                    {"  "}
                    <span className="text-brand-teal">{FULL_BAR}</span>
                    <span className="text-brand-muted">
                      {"  "}100% ({SKILLS.length}/{SKILLS.length})
                    </span>
                  </div>
                )}
                {summaryShown && (
                  <>
                    <div>&nbsp;</div>
                    <div>
                      {"  "}8 skills scanned{"  "}
                      <span className="text-brand-muted">{"\u2022"}</span>
                      {"  "}avg score 37{"  "}
                      <span className="text-brand-muted">{"\u2022"}</span>
                      {"  "}0 certified
                    </div>
                    <div>
                      {"  "}Findings: <span className="text-brand-red">17 critical</span>
                      <span className="text-brand-muted">, </span>
                      <span className="text-brand-red">30 high</span>
                      <span className="text-brand-muted">, </span>
                      <span className="text-brand-yellow">39 medium</span>
                      <span className="text-brand-muted">, </span>
                      <span className="text-brand-blue">33 low</span>
                    </div>
                    <div>&nbsp;</div>
                    <div>
                      {" "}
                      <span className="bg-brand-yellow text-brand-dark font-semibold px-1">
                        {" WARN "}
                      </span>
                      <span className="text-brand-yellow">
                        {"  "}47 high/critical finding(s) detected
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
