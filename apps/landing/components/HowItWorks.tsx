interface Step {
  number: number;
  title: string;
  description: string;
  icon: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: "Scan",
    description:
      "Run npx agentsec. It discovers every installed skill and scans them against OWASP AST10.",
    icon: "🔍",
  },
  {
    number: 2,
    title: "Report",
    description: "Get detailed findings with severity ratings and remediation guidance.",
    icon: "📊",
  },
  {
    number: 3,
    title: "Enforce",
    description: "Integrate policies into your CI/CD pipeline and team dashboards.",
    icon: "🛡️",
  },
];

export function HowItWorks(): React.ReactNode {
  return (
    <section id="how-it-works" className="section-pad bg-brand-dark">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-brand-muted max-w-2xl mx-auto">
            From discovery to enforcement in three simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col">
              {/* Card */}
              <div className="flex-1 p-8 border border-brand-border rounded-lg bg-brand-secondary hover:border-brand-teal transition-colors duration-300">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-teal text-brand-dark font-bold text-lg mb-4">
                  {step.number}
                </div>

                <div className="text-3xl mb-4">{step.icon}</div>

                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-brand-muted">{step.description}</p>
              </div>

              {/* Connector line (hidden on last item and on mobile) */}
              {step.number < 3 && (
                <div className="hidden md:block absolute top-16 -right-6 w-12 h-1 bg-gradient-to-r from-brand-teal to-transparent" />
              )}
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-16 p-8 border border-brand-border rounded-lg bg-brand-secondary text-center">
          <p className="text-brand-muted">
            <span className="text-brand-teal font-semibold">No config.</span> No SaaS. Runs in your
            repo.
          </p>
        </div>
      </div>
    </section>
  );
}
