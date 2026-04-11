"use client";

import { useEffect, useRef, useState } from "react";

const COMMAND = "npx agentsec";
const SCROLL_THRESHOLD = 10;
const COPIED_DURATION_MS = 2000;
const HIGHLIGHT_DURATION_MS = 500;

/**
 * Floating, fixed-position terminal-style CTA that appears after the user
 * scrolls past ~400px and stays pinned to the bottom-right corner. Clicking
 * anywhere on the surface copies `npx agentsec` to the clipboard, briefly
 * flashes a selection-style highlight over the command text, and swaps the
 * clipboard icon for a checkmark for two seconds.
 *
 * Hidden on small screens to avoid covering mobile content. Keyboard
 * accessible as a single `<button>`; copy success is announced through a
 * visually hidden live region. Honors `prefers-reduced-motion` by shortening
 * transitions via a media query in the className.
 */
export function StickyCopy(): React.ReactNode {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Guard setState so scroll-tick reconciliations are skipped when the
    // threshold state hasn't actually flipped.
    const onScroll = (): void => {
      const next = window.scrollY > SCROLL_THRESHOLD;
      setVisible((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const onCopy = async (): Promise<void> => {
    // Flash the highlight regardless of clipboard success so the click feels
    // responsive even on browsers without clipboard support.
    setHighlighted(true);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlighted(false), HIGHLIGHT_DURATION_MS);

    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_DURATION_MS);
    } catch {
      // ignore clipboard errors on unsupported browsers
    }
  };

  return (
    <div
      className={`hidden md:block fixed bottom-12 right-24 z-50 transition-opacity duration-300 motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy install command ${COMMAND}`}
        className="rounded-lg bg-brand-secondary overflow-hidden shadow-2xl focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-teal cursor-pointer"
      >
        <div className="flex items-center gap-1.5 px-3 py-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
          <span className="flex-1" aria-hidden="true" />
          {copied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 text-brand-green"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 text-brand-muted"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.927-2.185a48.208 48.208 0 0 1 1.927-.184"
              />
            </svg>
          )}
        </div>
        <div className="px-4 py-2.5 font-mono text-sm text-left">
          <span className="text-brand-muted">$ </span>
          <span
            className={`rounded-sm transition-colors duration-500 motion-reduce:transition-none ${
              highlighted ? "bg-brand-teal/20" : "bg-transparent"
            }`}
          >
            <span className="text-white">npx</span>
            <span className="text-brand-teal"> agentsec</span>
          </span>
        </div>
        {/* Visually hidden live region so screen readers get a single announcement
            when the copy succeeds, without polluting the button's accessible name. */}
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? "Copied to clipboard" : ""}
        </span>
      </button>
    </div>
  );
}
