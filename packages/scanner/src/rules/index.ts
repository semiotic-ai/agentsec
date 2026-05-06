export { checkDependencies } from "./dependencies";
export { checkUnsafeDeserialization } from "./deserialization";
export { checkDenialOfService } from "./dos";
export { checkErrorHandling } from "./error-handling";
export { checkInjection } from "./injection";
export { checkInsufficientLogging } from "./logging";
export { checkOutputHandling } from "./output-handling";
export { checkPermissions } from "./permissions";
export { checkStorage } from "./storage";
export { checkSupplyChain } from "./supply-chain";

import type { AgentSkill, SecurityFinding } from "@agentsec/shared";
import { checkDependencies } from "./dependencies";
import { checkUnsafeDeserialization } from "./deserialization";
import { checkDenialOfService } from "./dos";
import { checkErrorHandling } from "./error-handling";
import { checkInjection } from "./injection";
import { checkInsufficientLogging } from "./logging";
import { checkOutputHandling } from "./output-handling";
import { checkPermissions } from "./permissions";
import { checkStorage } from "./storage";
import { checkSupplyChain } from "./supply-chain";

export type RuleFunction = (skill: AgentSkill) => SecurityFinding[];

export interface RuleDefinition {
  name: string;
  category: string;
  description: string;
  /** OWASP Agentic Skills Top 10 identifier (e.g., "AST01"). */
  owaspId: string;
  /** Link to the OWASP Agentic Skills Top 10 project page. */
  owaspLink: string;
  run: RuleFunction;
}

const OWASP_BASE = "https://owasp.org/www-project-agentic-skills-top-10/";

/** All built-in security rules, mapped to OWASP Agentic Skills Top 10 categories. */
export const ALL_RULES: RuleDefinition[] = [
  {
    name: "injection",
    category: "skill-injection",
    description:
      "Detects prompt injection, eval/exec, dynamic code, and template injection vectors (AST-01)",
    owaspId: "AST01",
    owaspLink: OWASP_BASE,
    run: checkInjection,
  },
  {
    name: "permissions",
    category: "excessive-permissions",
    description: "Checks for excessive or dangerous permission requests (AST-03)",
    owaspId: "AST03",
    owaspLink: OWASP_BASE,
    run: checkPermissions,
  },
  {
    name: "output-handling",
    category: "insecure-output",
    description: "Checks for insecure output handling, XSS, and path traversal in outputs (AST-04)",
    owaspId: "AST04",
    owaspLink: OWASP_BASE,
    run: checkOutputHandling,
  },
  {
    name: "dependencies",
    category: "dependency-vulnerability",
    description: "Analyzes dependency tree for known vulnerabilities and typosquatting (AST-02)",
    owaspId: "AST02",
    owaspLink: OWASP_BASE,
    run: checkDependencies,
  },
  {
    name: "storage",
    category: "insecure-storage",
    description: "Detects insecure credential and secret storage patterns (AST-05)",
    owaspId: "AST05",
    owaspLink: OWASP_BASE,
    run: checkStorage,
  },
  {
    name: "logging",
    category: "insufficient-logging",
    description: "Checks for insufficient logging and monitoring (AST-08)",
    owaspId: "AST08",
    owaspLink: OWASP_BASE,
    run: checkInsufficientLogging,
  },
  {
    name: "dos",
    category: "denial-of-service",
    description:
      "Detects denial of service vectors: unbounded loops, ReDoS, resource exhaustion (AST-06)",
    owaspId: "AST06",
    owaspLink: OWASP_BASE,
    run: checkDenialOfService,
  },
  {
    name: "supply-chain",
    category: "supply-chain",
    description:
      "Checks for supply chain risks: unpinned deps, suspicious registries, install scripts (AST-02)",
    owaspId: "AST02",
    owaspLink: OWASP_BASE,
    run: checkSupplyChain,
  },
  {
    name: "error-handling",
    category: "improper-error-handling",
    description: "Checks for improper error handling that could leak information (AST-09)",
    owaspId: "AST09",
    owaspLink: OWASP_BASE,
    run: checkErrorHandling,
  },
  {
    name: "deserialization",
    category: "unsafe-deserialization",
    description: "Detects unsafe deserialization and prototype pollution patterns (AST-05)",
    owaspId: "AST05",
    owaspLink: OWASP_BASE,
    run: checkUnsafeDeserialization,
  },
];
