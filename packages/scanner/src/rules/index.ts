export { checkInjection } from "./injection";
export { checkPermissions } from "./permissions";
export { checkDependencies } from "./dependencies";
export { checkOutputHandling } from "./output-handling";
export { checkStorage } from "./storage";
export { checkSupplyChain } from "./supply-chain";
export { checkErrorHandling } from "./error-handling";
export { checkUnsafeDeserialization } from "./deserialization";
export { checkDenialOfService } from "./dos";
export { checkInsufficientLogging } from "./logging";

import type { AgentSkill, SecurityFinding } from "@agent-audit/shared";

import { checkInjection } from "./injection";
import { checkPermissions } from "./permissions";
import { checkDependencies } from "./dependencies";
import { checkOutputHandling } from "./output-handling";
import { checkStorage } from "./storage";
import { checkSupplyChain } from "./supply-chain";
import { checkErrorHandling } from "./error-handling";
import { checkUnsafeDeserialization } from "./deserialization";
import { checkDenialOfService } from "./dos";
import { checkInsufficientLogging } from "./logging";

export type RuleFunction = (skill: AgentSkill) => SecurityFinding[];

export interface RuleDefinition {
  name: string;
  category: string;
  description: string;
  run: RuleFunction;
}

/** All built-in security rules, mapped to OWASP Agentic Skills Top 10 categories. */
export const ALL_RULES: RuleDefinition[] = [
  {
    name: "injection",
    category: "skill-injection",
    description: "Detects prompt injection, eval/exec, dynamic code, and template injection vectors (AST-01)",
    run: checkInjection,
  },
  {
    name: "permissions",
    category: "excessive-permissions",
    description: "Checks for excessive or dangerous permission requests (AST-02)",
    run: checkPermissions,
  },
  {
    name: "output-handling",
    category: "insecure-output",
    description: "Checks for insecure output handling, XSS, and path traversal in outputs (AST-03)",
    run: checkOutputHandling,
  },
  {
    name: "dependencies",
    category: "dependency-vulnerability",
    description: "Analyzes dependency tree for known vulnerabilities and typosquatting (AST-04)",
    run: checkDependencies,
  },
  {
    name: "storage",
    category: "insecure-storage",
    description: "Detects insecure credential and secret storage patterns (AST-05)",
    run: checkStorage,
  },
  {
    name: "logging",
    category: "insufficient-logging",
    description: "Checks for insufficient logging and monitoring (AST-06)",
    run: checkInsufficientLogging,
  },
  {
    name: "dos",
    category: "denial-of-service",
    description: "Detects denial of service vectors: unbounded loops, ReDoS, resource exhaustion (AST-07)",
    run: checkDenialOfService,
  },
  {
    name: "supply-chain",
    category: "supply-chain",
    description: "Checks for supply chain risks: unpinned deps, suspicious registries, install scripts (AST-08)",
    run: checkSupplyChain,
  },
  {
    name: "error-handling",
    category: "improper-error-handling",
    description: "Checks for improper error handling that could leak information (AST-09)",
    run: checkErrorHandling,
  },
  {
    name: "deserialization",
    category: "unsafe-deserialization",
    description: "Detects unsafe deserialization and prototype pollution patterns (AST-10)",
    run: checkUnsafeDeserialization,
  },
];
