"use client";

import { useEffect, useRef, useState } from "react";

interface Risk {
  id: string;
  title: string;
  description: string;
}

const risks: Risk[] = [
  {
    id: "AST01",
    title: "Malicious Skills",
    description: "Skills designed to compromise systems or steal data.",
  },
  {
    id: "AST02",
    title: "Supply Chain Compromise",
    description: "Compromised skill dependencies or injection attacks.",
  },
  {
    id: "AST03",
    title: "Over-Privileged Skills",
    description: "Skills with excessive permissions beyond their function.",
  },
  {
    id: "AST04",
    title: "Insecure Metadata",
    description: "Missing or inaccurate skill documentation and descriptions.",
  },
  {
    id: "AST05",
    title: "Unsafe Deserialization",
    description: "Unsafe handling of skill parameters and inputs.",
  },
  {
    id: "AST06",
    title: "Weak Isolation",
    description: "Insufficient sandboxing or access control.",
  },
  {
    id: "AST07",
    title: "Update Drift",
    description: "Outdated or unpatched skill versions in production.",
  },
  {
    id: "AST08",
    title: "Poor Scanning",
    description: "Inadequate security assessment or monitoring.",
  },
  {
    id: "AST09",
    title: "No Governance",
    description: "Lack of policy enforcement and compliance controls.",
  },
  {
    id: "AST10",
    title: "Cross-Platform Reuse",
    description: "Skills used across platforms without validation.",
  },
];

export function OWASP(): React.ReactNode {
  const [visibleRisks, setVisibleRisks] = useState<Set<number>>(new Set());
  const riskRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = riskRefs.current.indexOf(
              entry.target as HTMLDivElement
            );
            if (index !== -1) {
              setVisibleRisks((prev) => new Set([...prev, index]));
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    riskRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="section-pad bg-brand-secondary">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            OWASP Agentic Skills Top 10
          </h2>
          <p className="text-xl text-brand-muted max-w-2xl mx-auto">
            Agent Audit scans against all 10 risk categories from the OWASP
            Agentic Skills framework.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {risks.map((risk, index) => (
            <div
              key={risk.id}
              ref={(el) => {
                if (el) riskRefs.current[index] = el;
              }}
              className={`p-6 border border-brand-border rounded-lg bg-brand-dark card-hover transition-all duration-700 ${
                visibleRisks.has(index)
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <div className="mb-3">
                <span className="inline-block px-3 py-1 rounded-full bg-brand-teal text-brand-dark text-xs font-bold">
                  {risk.id}
                </span>
              </div>
              <h3 className="text-lg font-bold mb-2">{risk.title}</h3>
              <p className="text-sm text-brand-muted">{risk.description}</p>
            </div>
          ))}
        </div>

        {/* Reference note */}
        <div className="mt-16 p-6 border border-brand-border rounded-lg bg-brand-dark text-center text-sm text-brand-muted">
          Based on{" "}
          <span className="text-brand-teal font-semibold">
            OWASP Agentic Skills Top 10
          </span>
          . Reference implementation available in the Agent Audit GitHub
          repository.
        </div>
      </div>
    </section>
  );
}
