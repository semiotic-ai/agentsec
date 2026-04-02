"use client";

import { useEffect, useRef, useState } from "react";

interface ProblemCard {
  icon: string;
  title: string;
  description: string;
  stat: string;
}

const problems: ProblemCard[] = [
  {
    icon: "👁️",
    title: "No Visibility",
    description:
      "Skills run on enterprise infrastructure with zero security oversight. You don't know what's executing.",
    stat: "91K+",
  },
  {
    icon: "🎯",
    title: "No Standards",
    description:
      "Each AI platform defines security differently. There's no unified framework for vulnerability assessment.",
    stat: "15+",
  },
  {
    icon: "📈",
    title: "Growing Attack Surface",
    description:
      "Skills ecosystem expanding rapidly with no centralized scanning or governance layer.",
    stat: "91K+",
  },
  {
    icon: "🔒",
    title: "Enterprise Blockers",
    description:
      "Compliance teams demand audit trails. Security teams demand penetration testing. Budgets are tight.",
    stat: "$0",
  },
];

export function Problem(): React.ReactNode {
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = cardRefs.current.indexOf(
              entry.target as HTMLDivElement
            );
            if (index !== -1) {
              setVisibleCards((prev) => new Set([...prev, index]));
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="section-pad bg-brand-secondary">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            The Problem
          </h2>
          <p className="text-xl text-brand-muted max-w-2xl mx-auto">
            AI agent skills are expanding at scale, but security tooling hasn't kept pace.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {problems.map((problem, index) => (
            <div
              key={index}
              ref={(el) => {
                if (el) cardRefs.current[index] = el;
              }}
              className={`p-8 border border-brand-border rounded-lg bg-brand-dark card-hover transition-all duration-700 ${
                visibleCards.has(index)
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <div className="text-4xl mb-4">{problem.icon}</div>
              <h3 className="text-xl font-bold mb-3">{problem.title}</h3>
              <p className="text-brand-muted mb-4">{problem.description}</p>
              <div className="pt-4 border-t border-brand-border">
                <span className="text-2xl font-bold text-brand-teal">
                  {problem.stat}
                </span>
                <span className="text-brand-muted ml-2">
                  {index === 0 && "installed skills"}
                  {index === 1 && "AI platforms"}
                  {index === 2 && "skills ecosystem"}
                  {index === 3 && "cost to start"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
