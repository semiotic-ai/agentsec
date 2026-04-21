"use client";

import { useEffect, useState } from "react";

type FormatKey = "text" | "json" | "sarif" | "html";

type FormatMeta = {
  label: FormatKey;
  ext: string;
  desc: string;
  href: string;
  rawLabel: string;
};

const FORMATS: Record<FormatKey, FormatMeta> = {
  text: {
    label: "text",
    ext: "audit-report.txt",
    desc: "Plain-text report for logs and diffs.",
    href: "/examples/audit-report.txt",
    rawLabel: "Open audit-report.txt →",
  },
  html: {
    label: "html",
    ext: "audit-report.html",
    desc: "Self-contained HTML report — open to render.",
    href: "/examples/audit-report.html",
    rawLabel: "View rendered HTML →",
  },
  json: {
    label: "json",
    ext: "audit-report.json",
    desc: "Full machine-readable audit payload.",
    href: "/examples/audit-report.json",
    rawLabel: "Open audit-report.json →",
  },
  sarif: {
    label: "sarif",
    ext: "audit-report.sarif",
    desc: "SARIF 2.1 for IDEs, GitHub, and code-scanning.",
    href: "/examples/audit-report.sarif",
    rawLabel: "Open audit-report.sarif →",
  },
};

const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[];
const TERMINAL_HEIGHT = 500;

export function Formats(): React.ReactNode {
  const [active, setActive] = useState<FormatKey>("text");
  const [cache, setCache] = useState<Partial<Record<FormatKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache[active] !== undefined) {
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(FORMATS[active].href)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setCache((prev) => ({ ...prev, [active]: text }));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, cache]);

  const content = cache[active];

  return (
    <section id="formats" className="section-pad">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
          <div className="lg:sticky lg:top-24">
            <div className="font-eyebrow mb-3">Outputs</div>
            <h2 className="font-h1 mb-5 text-brand-text">
              One scan.
              <br />
              Four formats.
            </h2>
            <p className="font-lead mb-8">
              Humans read text. CI reads JSON. IDEs consume SARIF. Stakeholders open HTML. AgentSec
              emits any of them with{" "}
              <code className="font-mono text-brand-teal text-[14px]">--format</code>.
            </p>
            <div className="flex flex-col gap-1">
              {FORMAT_KEYS.map((k) => {
                const meta = FORMATS[k];
                const isActive = k === active;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setActive(k)}
                    className={`grid grid-cols-[auto_1fr] gap-4 items-center text-left px-4 py-3.5 rounded-lg cursor-pointer border transition-all duration-150 ${
                      isActive
                        ? "bg-brand-card border-brand-border-strong"
                        : "bg-transparent border-transparent hover:bg-brand-card/50"
                    }`}
                  >
                    <span
                      className={`font-mono text-[13px] w-16 whitespace-nowrap ${
                        isActive ? "text-brand-teal" : "text-brand-dim"
                      }`}
                    >
                      --{meta.label}
                    </span>
                    <div>
                      <div className="text-sm text-brand-text">{meta.ext}</div>
                      <div className="text-xs text-brand-dim mt-0.5">{meta.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="bg-brand-secondary border border-brand-border rounded-xl overflow-hidden shadow-brand-2">
              <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-brand-border bg-brand-card">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
                </div>
                <span className="font-mono text-xs text-brand-dim truncate">
                  {FORMATS[active].ext}
                </span>
                <span className="font-mono text-[11px] text-brand-teal whitespace-nowrap">
                  --format {active}
                </span>
              </div>
              <pre
                className="px-6 py-5 m-0 font-mono text-[12px] leading-[1.7] text-brand-text whitespace-pre overflow-auto"
                style={{ height: TERMINAL_HEIGHT }}
              >
                {error ? (
                  <span className="text-brand-red">
                    Failed to load {FORMATS[active].ext}: {error}
                  </span>
                ) : content === undefined || loading ? (
                  <span className="text-brand-dim">Loading {FORMATS[active].ext}…</span>
                ) : (
                  content
                )}
              </pre>
            </div>
            <div className="mt-4 flex justify-end">
              <a
                href={FORMATS[active].href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-border bg-brand-secondary text-sm text-brand-text hover:border-brand-teal hover:text-brand-teal transition-colors"
              >
                {FORMATS[active].rawLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
