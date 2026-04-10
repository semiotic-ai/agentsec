"use client";

import { useEffect, useRef, useState } from "react";

interface CopyCommandButtonProps {
  /** The shell command string to copy (e.g. "npx agentsec"). */
  command: string;
  /** Visual size — `"lg"` for the Hero's primary CTA, `"md"` for secondary. */
  size?: "md" | "lg";
  /** Extra class names to merge onto the root button. */
  className?: string;
}

/**
 * Accessible copy-to-clipboard button styled as a minimal macOS Terminal
 * window. Shows a title bar with three traffic-light dots and a small copy
 * icon on the right, and a body row with the prompt and command. Click
 * anywhere on the window to copy the command to the clipboard. A transient
 * "Copied!" status is announced to screen readers for 2 seconds.
 *
 * Rendered as a single `<button>` so the entire surface is clickable and
 * focusable. Uses a useRef-tracked timeout so rapid double-clicks and
 * component unmounts clean up properly.
 */
export function CopyCommandButton({
  command,
  size = "lg",
  className = "",
}: CopyCommandButtonProps): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors on unsupported browsers
    }
  };

  const bodyClasses =
    size === "lg"
      ? "px-4 py-3 md:py-4 font-mono text-base md:text-lg text-brand-text text-left"
      : "px-4 py-3 font-mono text-base text-brand-text text-left";

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy install command ${command}`}
      className={`group rounded-lg border border-brand-border bg-brand-secondary overflow-hidden hover:bg-brand-card focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2 focus:ring-offset-brand-dark transition-colors duration-150 cursor-pointer ${className}`}
    >
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-brand-border">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" aria-hidden="true" />
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
            className="w-4 h-4 text-brand-muted group-hover:text-brand-teal transition-colors"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
            />
          </svg>
        )}
      </div>
      <div className={bodyClasses}>
        <span className="text-brand-muted">$ </span>
        <span className="text-brand-teal">{command}</span>
      </div>
      {/* Visually hidden live region so screen readers get a single announcement
          when the copy succeeds, without polluting the button's accessible name. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
