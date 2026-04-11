type Commandment = {
  id: string;
  slug: string;
  name: string;
  whatItIs: string;
  whyItMatters: string;
};

const commandments: readonly Commandment[] = [
  {
    id: "AST-01",
    slug: "ast01",
    name: "Malicious Skills",
    whatItIs:
      "Skills that look legitimate but ship hidden payloads — credential stealers, backdoors, or prose-level prompt injection.",
    whyItMatters:
      "Skills run with the agent's full permissions, so one bad install can leak keys, SSH, wallets, and shell access.",
  },
  {
    id: "AST-02",
    slug: "ast02",
    name: "Supply Chain Compromise",
    whatItIs:
      "Skill registries lack the provenance controls mature package ecosystems take for granted.",
    whyItMatters:
      "Publishing barriers are minimal and a single compromised dependency inherits the agent's entire credential set.",
  },
  {
    id: "AST-03",
    slug: "ast03",
    name: "Over-Privileged Skills",
    whatItIs: "Skills that request far more permissions than their task actually needs.",
    whyItMatters:
      "Research shows roughly 90% of agent skills are over-permissioned — every extra scope widens the blast radius.",
  },
  {
    id: "AST-04",
    slug: "ast04",
    name: "Insecure Metadata",
    whatItIs:
      "Hidden capabilities that don't match a skill's public description or declared manifest.",
    whyItMatters:
      "Reviewers can't consent to risks they can't see; brand impersonation rides in on the same vector.",
  },
  {
    id: "AST-05",
    slug: "ast05",
    name: "Unsafe Deserialization",
    whatItIs: "YAML, JSON, and markdown parsed by skill loaders without sandboxing.",
    whyItMatters:
      "Attackers can ship executable payloads that trigger on skill load, before any user action.",
  },
  {
    id: "AST-06",
    slug: "ast06",
    name: "Weak Isolation",
    whatItIs:
      "Skills executing without effective containment between the skill and the host agent.",
    whyItMatters: "Sandbox escapes turn a single exploited skill into full host compromise.",
  },
  {
    id: "AST-07",
    slug: "ast07",
    name: "Update Drift",
    whatItIs: "Skills that silently change after they were approved and reviewed.",
    whyItMatters:
      "Reviews go stale the moment the upstream skill ships a new version; signed audits don't survive drift.",
  },
  {
    id: "AST-08",
    slug: "ast08",
    name: "Poor Scanning",
    whatItIs:
      "Traditional scanners that miss AI-specific attack patterns buried in prose and metadata.",
    whyItMatters:
      "Malicious instructions hide in plain English; matching on code alone leaves the prose layer untouched.",
  },
  {
    id: "AST-09",
    slug: "ast09",
    name: "Insufficient Governance",
    whatItIs: "Organizations running agents with no inventory of which skills are installed where.",
    whyItMatters:
      "You can't audit, patch, or revoke what you can't see; incidents become forensic archaeology.",
  },
  {
    id: "AST-10",
    slug: "ast10",
    name: "Cross-Platform Reuse",
    whatItIs: "Skills that are safe on one platform but dangerous when reused on another.",
    whyItMatters:
      "Permission models differ across OpenClaw, Claude Code, and Cursor — the same skill is not the same risk.",
  },
];

const OWASP_PROJECT_URL = "https://owasp.org/www-project-agentic-skills-top-10/";
const OWASP_REPO_URL = "https://github.com/OWASP/www-project-agentic-skills-top-10";

export function TenCommandments(): React.ReactNode {
  return (
    <section
      id="commandments"
      className="bg-brand-dark py-20 md:py-24 border-t border-brand-border"
    >
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-brand-text">
          The 10 Agent Security Commandments
        </h2>
        <p className="text-brand-muted text-center mb-12">
          The{" "}
          <a
            href={OWASP_PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-teal hover:underline"
          >
            OWASP Agentic Skills Top 10
          </a>{" "}
          — the ten risks AgentSec audits. Original research by the OWASP AST10 team.
        </p>
        <ul className="border-t border-brand-border/50">
          {commandments.map((item) => (
            <li key={item.id}>
              <details className="group border-b border-brand-border/50">
                <summary className="list-none flex items-center gap-4 py-4 px-2 cursor-pointer hover:bg-brand-secondary/50 transition-colors focus-visible:outline-2 focus-visible:outline-brand-teal focus-visible:outline-offset-2">
                  <span className="font-mono text-sm text-brand-teal whitespace-nowrap w-20 shrink-0">
                    {item.id}
                  </span>
                  <span className="text-base md:text-lg text-brand-text flex-1">{item.name}</span>
                  <span
                    className="text-brand-muted text-sm transition-transform duration-200 group-open:rotate-90 shrink-0"
                    aria-hidden="true"
                  >
                    &#9656;
                  </span>
                </summary>
                <div className="pl-6 pr-4 pb-4 pt-1 text-sm text-brand-muted space-y-2 max-w-2xl">
                  <p>
                    <span className="text-brand-text font-semibold">What it is:</span>{" "}
                    {item.whatItIs}
                  </p>
                  <p>
                    <span className="text-brand-text font-semibold">Why it matters:</span>{" "}
                    {item.whyItMatters}
                  </p>
                  <p>
                    <span className="text-brand-text font-semibold">Read more:</span>{" "}
                    <a
                      href={`${OWASP_PROJECT_URL}${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-teal hover:underline"
                    >
                      OWASP {item.id}
                    </a>
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <p className="text-xs text-brand-muted text-center mt-8">
          Risks and labels based on the OWASP Agentic Skills Top 10 (CC BY-SA 4.0). Read the full
          project on{" "}
          <a
            href={OWASP_PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-teal hover:underline"
          >
            OWASP.org
          </a>{" "}
          and contribute on{" "}
          <a
            href={OWASP_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-teal hover:underline"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
