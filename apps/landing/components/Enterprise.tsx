"use client";

import { type FormEvent, useId, useState } from "react";

const CONTACT_EMAIL = "mark@semiotic.ai";
const DEFAULT_MESSAGE = "Hi — I'm interested in agentsec. Could you tell me more?";

function buildGmailComposeUrl({ to, message }: { to: string; message: string }): string {
  const url = new URL("https://mail.google.com/mail/");
  url.searchParams.set("view", "cm");
  url.searchParams.set("fs", "1");
  url.searchParams.set("to", to);
  url.searchParams.set("su", "agentsec — inquiry");
  url.searchParams.set("body", message);
  return url.toString();
}

export function Enterprise(): React.ReactNode {
  return (
    <section
      id="enterprise"
      className="section-pad relative overflow-hidden border-t border-brand-border/60"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,210,180,0.14), transparent 60%)",
        }}
      />

      <div className="relative max-w-[920px] mx-auto px-6">
        <div className="text-center mb-10">
          <div className="font-eyebrow mb-3">Get in touch</div>
          <h2 className="font-h1 text-brand-text mb-5">
            Questions about
            <br />
            <span className="bg-gradient-to-b from-brand-teal to-brand-teal-dim bg-clip-text text-transparent">
              skill security?
            </span>
          </h2>
          <p className="font-lead max-w-[560px] mx-auto">
            Whether you're building a skill, evaluating skills you've installed, or thinking about
            agent security broadly, say hello.
          </p>
        </div>

        <ContactForm />
      </div>
    </section>
  );
}

function ContactForm(): React.ReactNode {
  const formId = useId();
  const [composeUrl, setComposeUrl] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const typed = String(data.get("message") ?? "").trim();
    const message = typed || DEFAULT_MESSAGE;
    const url = buildGmailComposeUrl({ to: CONTACT_EMAIL, message });
    window.open(url, "_blank", "noopener,noreferrer");
    setComposeUrl(url);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-2xl border border-brand-border bg-brand-secondary shadow-brand-3 overflow-hidden max-w-[560px] mx-auto"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,210,180,0.06) 0%, transparent 35%, transparent 100%)",
        }}
      />
      <div className="relative p-6 md:p-8">
        <div className="mb-6">
          <label
            htmlFor={`${formId}-message`}
            className="block text-[13px] font-medium text-brand-text mb-2"
          >
            Message <span className="text-brand-dim font-normal">(optional)</span>
          </label>
          <textarea
            id={`${formId}-message`}
            name="message"
            rows={4}
            placeholder="What's on your mind? Leave blank to send a quick 'tell me more.'"
            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3.5 py-2.5 text-[14px] text-brand-text placeholder:text-brand-dim/70 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/40 resize-y min-h-[110px]"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 bg-brand-teal text-brand-dark text-sm font-semibold px-5 py-3 rounded-lg shadow-brand-teal hover:bg-brand-teal-dim hover:-translate-y-[1px] hover:shadow-brand-teal-strong transition-all duration-200"
        >
          Get in touch
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>

        {composeUrl && (
          <p className="mt-4 text-[13px] text-brand-dim" aria-live="polite">
            Gmail should have opened in a new tab.{" "}
            <a
              href={composeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-teal hover:underline"
            >
              Didn't open? Click here
            </a>
            .
          </p>
        )}
      </div>
    </form>
  );
}
