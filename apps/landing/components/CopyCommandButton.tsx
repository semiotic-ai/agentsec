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
 * Accessible copy-to-clipboard button that displays a shell command and
 * copies it to the clipboard on click. Shows a transient "Copied!" status
 * for 2 seconds.
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

  const pad = size === "lg" ? "px-6 py-4" : "px-5 py-3";
  const fontSize = size === "lg" ? "text-lg md:text-xl" : "text-base";

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy install command ${command}`}
      className={`group flex items-center gap-4 ${pad} bg-brand-secondary border-2 border-brand-teal rounded-lg hover:bg-brand-card hover:shadow-[0_0_40px_rgba(0,210,180,0.3)] focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2 focus:ring-offset-brand-dark transition-all duration-200 cursor-pointer ${className}`}
    >
      <span className={`font-mono ${fontSize} text-brand-text`}>
        <span className="text-brand-muted">$ </span>
        <span className="text-brand-teal">{command}</span>
      </span>
      <span className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-md bg-brand-teal text-brand-dark group-hover:bg-brand-text transition-colors">
        {copied ? "Copied!" : "Copy"}
      </span>
      {/* Visually hidden live region so screen readers get a single announcement
          when the copy succeeds, without polluting the button's accessible name. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
