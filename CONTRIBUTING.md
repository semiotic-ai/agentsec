# Contributing to Agent Audit

Thank you for your interest in contributing to Agent Audit. This guide will help you get started.

## Prerequisites

- [Bun](https://bun.sh) v1.3.11 or later
- [Git](https://git-scm.com)
- TypeScript knowledge

## Setup

```bash
git clone https://github.com/agent-audit/agent-audit.git
cd agent-audit
bun install
bun run build
bun run test
```

## Development Workflow

1. **Create your changes** on the `main` branch (we commit directly to main).
2. **Build** to verify everything compiles: `bun run build`
3. **Test** to make sure nothing is broken: `bun run test`
4. **Lint** to check code style: `bun run lint`
5. **Commit** with a clear, descriptive message.

## Monorepo Layout

This project uses Turborepo with bun workspaces. Each package lives under `packages/`:

| Package | Name | Description |
|---------|------|-------------|
| `shared` | `@agent-audit/shared` | Shared types, constants, utilities |
| `scanner` | `@agent-audit/scanner` | Skill scanning engine |
| `metrics` | `@agent-audit/metrics` | Security scoring and risk calculation |
| `policy` | `@agent-audit/policy` | Policy rules and compliance checks |
| `openclaw` | `@agent-audit/openclaw` | OpenClaw format support |
| `reporter` | `@agent-audit/reporter` | Report generation |
| `cli` | `@agent-audit/cli` | CLI entry point |

The `apps/` directory contains the web dashboard.

## Working on a Specific Package

```bash
# Build one package and its dependencies
turbo build --filter=@agent-audit/scanner

# Run tests for one package
bun test --filter @agent-audit/scanner

# Add a dependency to a package
cd packages/scanner && bun add <package>
```

## Code Standards

- **TypeScript** targeting ES2022 with strict mode
- **bun test** for all tests (not jest, vitest, or mocha)
- Use `import type` for type-only imports
- Prefer named exports over default exports
- All public APIs must have JSDoc comments
- Never use `eval()` or dynamic code execution

## Security

This is a security-focused project. Please follow these rules:

- Never commit secrets, API keys, tokens, or credentials
- Always validate external inputs
- Sanitize user-controlled data in outputs
- Pin exact versions for security-critical dependencies
- Run `bun audit` before adding new packages

## Testing

Write tests for all new functionality. Place test files alongside the code they test:

```
packages/scanner/
  src/
    analyze.ts
    analyze.test.ts
```

Run the full test suite before committing:

```bash
bun run test
```

## Commit Messages

Write clear commit messages that explain what changed and why:

```
Add permission model validation for AST03 checks

The scanner now validates skill permission declarations against
the least-privilege policy defined in the active ruleset.
```

## Reporting Security Issues

If you discover a security vulnerability, please do **not** open a public issue. Instead, email security@agent-audit.dev with details. We will respond within 48 hours.

## License

By contributing to Agent Audit, you agree that your contributions will be licensed under the [MIT License](LICENSE).
