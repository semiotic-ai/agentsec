# Contributing to AgentSec

Thank you for your interest in contributing to AgentSec! We welcome contributions from security researchers, TypeScript developers, and anyone passionate about AI agent security.

## Prerequisites

- [Bun](https://bun.sh) v1.3.11 or later -- fast, TypeScript-native runtime
- [Git](https://git-scm.com) -- version control
- macOS, Linux, or WSL on Windows

Use **bun** everywhere. Do not use npm, yarn, or pnpm.

## Quick Setup

```bash
git clone https://github.com/semiotic-ai/agentsec.git
cd agentsec
bun install
bun run build
bun run test
```

If any step fails, see [Troubleshooting](#troubleshooting) below.

## Monorepo Structure

This is a **Turborepo** monorepo with **bun workspaces**. All packages live under `packages/`:

```
agentsec/
  packages/
    shared/        @agentsec/shared      - Shared types, constants, utilities
    scanner/       @agentsec/scanner     - Skill scanning engine and detectors
    metrics/       @agentsec/metrics     - Security scoring algorithms
    policy/        @agentsec/policy      - Policy rules and compliance engine
    openclaw/      @agentsec/openclaw    - OpenClaw (SKILL.md) format support
    reporter/      @agentsec/reporter    - Report generation (HTML, JSON, SARIF)
    cli/           @agentsec/cli         - CLI entry point (published as "agentsec")
  apps/
    landing/       @agentsec/landing     - Marketing landing page
```

### Dependency Graph

Packages must only depend on packages above them in this graph:

```
shared (no internal dependencies)
  ^
  |--- scanner
  |--- metrics
  |--- policy
  |--- openclaw
  \--- reporter
         ^
         \--- cli
```

## How to Run Tests

```bash
# Run all tests across the monorepo
bun run test

# Run tests for a single package
bun test --filter @agentsec/scanner

# Watch mode (rerun on file changes)
bun test --watch

# With coverage
bun test --coverage
```

Place test files alongside the code they test: `analyze.ts` -> `analyze.test.ts`.

```typescript
import { test, expect } from 'bun:test';
import { analyzeSkill } from './scanner';

test('detects eval() usage', () => {
  const findings = analyzeSkill('./test-fixtures/malicious-skill');
  expect(findings).toContainEqual({
    severity: 'critical',
    riskId: 'AST05',
  });
});
```

## How to Add a Scanner Rule

Scanner rules live in `packages/scanner/src/rules/`. Each rule file exports a function that takes an `AgentSkill` and returns an array of `SecurityFinding` objects.

### 1. Create the rule file

Create `packages/scanner/src/rules/your-rule.ts`:

```typescript
import type { AgentSkill, SecurityFinding } from '@agentsec/shared';

/**
 * Rule: Your Rule Name (AST-XX)
 *
 * Detects <what this rule catches>.
 */
export function checkYourRule(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const file of skill.files) {
    // Match patterns in file content
    const pattern = /your-regex-here/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(file.content)) !== null) {
      findings.push({
        id: 'YOURRULE-001',
        title: 'Description of finding',
        description: 'Detailed explanation of why this is a risk.',
        severity: 'high',
        riskId: 'AST01',
        filePath: file.path,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation: 'How to fix this issue.',
      });
    }
  }

  return findings;
}
```

### 2. Register in the rule index

Add your rule to `packages/scanner/src/rules/index.ts`:

```typescript
// Add the import
export { checkYourRule } from './your-rule';
import { checkYourRule } from './your-rule';

// Add to ALL_RULES array
{
  name: 'your-rule',
  category: 'your-category',
  description: 'What this rule detects (AST-XX)',
  owaspId: 'ASTXX',
  owaspLink: OWASP_BASE,
  run: checkYourRule,
},
```

### 3. Add tests

Create `packages/scanner/src/rules/your-rule.test.ts` with tests covering both detection and false-positive avoidance. Use the existing rule tests as examples.

### 4. Add a test fixture

Create a fixture skill under `e2e/fixtures/` that triggers your rule (see next section).

### Existing rules for reference

| File | Category | OWASP |
|------|----------|-------|
| `injection.ts` | Code injection detection | AST01 |
| `permissions.ts` | Permission analysis | AST03 |
| `dependencies.ts` | Dependency risk checks | AST02 |
| `supply-chain.ts` | Supply chain indicators | AST02 |
| `storage.ts` | Insecure storage patterns | AST05 |
| `deserialization.ts` | Unsafe deserialization | AST05 |
| `dos.ts` | Denial of service patterns | AST06 |
| `logging.ts` | Logging hygiene | AST08 |
| `error-handling.ts` | Error handling checks | AST09 |
| `output-handling.ts` | Output sanitization | AST04 |

## How to Create Test Fixtures

Test fixtures live in `e2e/fixtures/`. Each fixture is a self-contained skill directory that represents a specific scanning scenario.

### Fixture structure

```
e2e/fixtures/your-fixture-skill/
  skill.json          # Required: skill manifest
  src/
    index.ts          # Required: main source file with patterns to detect
    utils.ts          # Optional: additional source files
  package.json        # Optional: needed for dependency-related rules
```

### skill.json format

```json
{
  "name": "your-fixture-skill",
  "version": "1.0.0",
  "description": "Fixture that triggers <specific rule or pattern>",
  "author": "test-author",
  "license": "MIT",
  "engine": "openclaw@^0.9.0",
  "permissions": ["clipboard:read"],
  "inputs": {},
  "outputs": {}
}
```

### Tips

- Name the fixture after the vulnerability it demonstrates (e.g., `injection-vuln-skill`, `excessive-perms-skill`).
- Include only the minimal code needed to trigger the rule.
- Add a `good-skill` equivalent if testing that clean code produces no false positives.
- Put intentionally vulnerable code in `src/` files so the scanner can find it.

### Existing fixtures

| Fixture | What it tests |
|---------|---------------|
| `good-skill` | Clean skill, no findings expected |
| `injection-vuln-skill` | Code injection vulnerabilities |
| `excessive-perms-skill` | Overly broad permissions |
| `bad-deps-skill` | Problematic dependencies |
| `bad-injection-skill` | Injection pattern variant |
| `supply-chain-skill` | Supply chain risk indicators |
| `bad-permissions-skill` | Overly broad permission declarations |
| `insecure-storage-skill` | Insecure data storage patterns |

## Code Style

### Formatting

- **Linter**: Biome (configured in `biome.json`)
- **Indentation**: 2 spaces
- **Line width**: 100 characters
- **Semicolons**: Required
- **Trailing commas**: ES5 style

Run the linter and auto-fix:

```bash
bun run lint
bunx biome check --write .
```

### TypeScript

- Target **ES2022** (see `tsconfig.json`)
- **Strict mode** enabled -- avoid `any` without good reason
- Use `import type` for type-only imports
- Prefer named exports over default exports
- Use `const` by default, `let` only when reassignment is needed
- All public APIs must have JSDoc comments

Example:

```typescript
import type { Finding } from '@agentsec/shared';

/**
 * Analyze a skill for security findings.
 *
 * @param skillPath - Absolute path to the skill directory
 * @returns Array of findings, empty if no issues
 * @throws {Error} If the skill cannot be read or parsed
 */
export function analyzeSkill(skillPath: string): Finding[] {
  // ...
}
```

## Security Rules

This is a **security-focused project**. Follow these rules strictly:

1. **Never commit secrets** -- no API keys, tokens, passwords, or credentials in code or fixtures
2. **Always validate inputs** -- all external data must be validated before use
3. **Sanitize outputs** -- escape user-controlled data in reports and logs
4. **Pin dependencies** -- use exact versions for security-critical packages
5. **No eval or dynamic code execution** -- never use `eval()`, `new Function()`, or similar in production code
6. **Check for vulnerabilities** -- run `bun audit` before adding new packages

### Reporting Security Issues

Found a vulnerability? **Do not open a public issue.** Email **security@agentsec.sh** with a description, reproduction steps, and impact assessment. We respond within 48 hours.

## Commit Conventions

Write commit messages that explain **what** changed and **why**:

```
Add permission model validation for AST03 checks

The scanner now validates skill permission declarations against
the least-privilege policy defined in the active ruleset. This
addresses OWASP AST03 (Over-Privileged Skills) risk category.

Fixes #123
```

### Rules

- **First line**: imperative mood ("Add" not "Added"), under 50 characters
- **Body**: explain the "why", not just the "what"
- **References**: link related issues with "Fixes #123" or "Relates to #456"
- **Line length**: keep under 100 characters per line
- **Atomic commits**: one logical change per commit

### Prefixes

Use a prefix that describes the type of change:

- `feat:` -- new feature or capability
- `fix:` -- bug fix
- `enhance:` -- improvement to existing feature
- `refactor:` -- code restructuring without behavior change
- `test:` -- adding or updating tests
- `docs:` -- documentation changes
- `chore:` -- maintenance, dependencies, tooling

## Development Commands

```bash
# Full pipeline
bun install && bun run build && bun run test && bun run lint

# Build a specific package
turbo build --filter=@agentsec/scanner

# Type check everything
bun run check

# Clean build artifacts
bun run clean

# Dev mode (watch and rebuild)
bun run dev
```

## Working on a Specific Package

```bash
cd packages/scanner

# Build this package and its dependencies
turbo build --filter=@agentsec/scanner

# Test this package only
bun test --filter @agentsec/scanner

# Watch mode (rebuilds on changes)
turbo watch build --filter=@agentsec/scanner
```

## Continuous Integration

Every push triggers the CI pipeline:

1. `bun run lint` -- linting must pass
2. `bun run check` -- type checking must pass
3. `bun run test` -- tests must pass
4. `bun run build` -- build must succeed

Run locally before pushing:

```bash
bun run lint && bun run check && bun run test && bun run build
```

## Troubleshooting

### `bun install` fails

Old lockfile or corrupted cache:

```bash
rm -rf node_modules .bun-lock ~/.bun
bun install
```

### TypeScript errors after changes

Types not rebuilt:

```bash
bun run clean
bun run build
```

### Tests fail on first run

Check fixture paths in test files. Ensure paths are absolute or relative to the package root.

### Linter complaints about spacing

Let Biome auto-fix:

```bash
bunx biome check --write .
```

## Questions?

- **General questions**: Create a GitHub Discussion
- **Bug reports**: Create an Issue with `[BUG]` in the title
- **Feature requests**: Create an Issue with `[FEATURE]` in the title
- **Security issues**: Email security@agentsec.sh

## License

By contributing to AgentSec, you agree your contributions will be licensed under the [MIT License](LICENSE).
