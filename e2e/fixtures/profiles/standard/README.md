# Standard agent skills (placeholder)

## Intent

Hosts general-purpose agent skills that don't fit a specific domain — utilities, glue code, format helpers, dev-loop conveniences. The audit goal is to surface baseline AST10 hygiene (over-privileged permissions, supply-chain hygiene, metadata correctness) on skills that look "harmless" and might otherwise dodge scrutiny.

## Status

Empty scaffold — populate when we expand the fixture suite beyond Web3.

## Suggested initial fixtures

- `git-commit-helper` — generates conventional-commit messages from a diff.
- `markdown-toc` — auto-generates a table of contents for Markdown files.
- `json-pretty` — pretty-prints / sorts / validates JSON blobs.

When this profile is filled in, follow the structure used by `../web3/` (a per-profile `index.json` plus one fixture directory per skill, with the AST10 expected-rule mapping documented in this README).
