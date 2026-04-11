"use client";

import { useEffect, useRef, useState } from "react";

const FIELD_CLASSES =
  "bg-brand-secondary border border-brand-border rounded-lg px-4 py-3 text-brand-text placeholder-brand-muted focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/50 transition-colors";
const LABEL_CLASSES = "text-sm text-brand-muted mb-2 block";

/**
 * Contact form that opens the visitor's email client with a pre-populated
 * message addressed to `mark@semiotic.ai`. Uses a `mailto:` URL so the form
 * has no server dependency; the user sends the mail from their own client.
 *
 * Accessible by default: every input has a linked `<label>`, required fields
 * carry `aria-required`, and a polite status region announces the confirmation
 * after submit. Tab order follows the visual order of the fields.
 */
export function ContactForm(): React.ReactNode {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const subject = `Contact from ${name}`;
    const body = `${message}\n\n-- \nFrom: ${name} <${email}>`;
    const mailtoUrl = `mailto:mark@semiotic.ai?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => setSubmitted(false), 5000);
    window.location.href = mailtoUrl;
  };

  return (
    <section id="contact" className="bg-brand-dark py-20 md:py-24 border-t border-brand-border">
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-brand-text">
          Get in touch
        </h2>
        <p className="text-brand-muted text-center mb-10">
          Questions, feedback, or want to audit your agent fleet? Send us a note.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col">
            <label htmlFor="contact-name" className={LABEL_CLASSES}>
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              aria-required="true"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className={FIELD_CLASSES}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="contact-email" className={LABEL_CLASSES}>
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              aria-required="true"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={FIELD_CLASSES}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="contact-message" className={LABEL_CLASSES}>
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              aria-required="true"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="How can we help?"
              className={`${FIELD_CLASSES} resize-y`}
            />
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-2">
            <button
              type="submit"
              className="bg-brand-teal text-brand-dark font-semibold px-6 py-3 rounded-lg hover:bg-brand-teal/90 transition-colors w-full md:w-auto"
            >
              Send message
            </button>
            <p role="status" aria-live="polite" className="text-sm text-brand-muted">
              {submitted ? "Your mail app should open shortly…" : ""}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
