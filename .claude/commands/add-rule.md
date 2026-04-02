---
description: Add a new security scanning rule to agent-audit
---

Help me add a new security scanning rule. Ask me:
1. What vulnerability does this rule detect?
2. Which OWASP Agentic Skills Top 10 category does it map to? (AST-01 through AST-10)
3. What code patterns should it match?

Then:
1. Create the rule file in `packages/scanner/src/rules/` following existing rule patterns
2. Register it in `packages/scanner/src/rules/index.ts` (both the export and the ALL_RULES array)
3. Add tests in `packages/scanner/src/__tests__/`
4. Run `bun test` in `packages/scanner` to verify
5. Rebuild: `cd packages/scanner && bun build src/index.ts --outdir dist --target bun`
