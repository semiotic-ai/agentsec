# Document agent skills (placeholder)

## Intent

Hosts skills that ingest, transform, or generate documents — PDFs, DOCX, contracts, legal text, redactions, classifications. The audit goal is to surface AST10 risks specific to document workflows (unsafe deserialization of DOC/PDF inputs, prompt injection through document content, insecure metadata, over-broad filesystem access).

## Status

Empty scaffold — populate when we expand the fixture suite beyond Web3.

## Suggested initial fixtures

- `pdf-extract` — text + table extraction from arbitrary PDF input.
- `docx-redact` — find-and-redact regex pipeline against DOCX.
- `contract-classify` — clause classifier for legal text.

When this profile is filled in, follow the structure used by `../web3/` (a per-profile `index.json` plus one fixture directory per skill, with the AST10 expected-rule mapping documented in this README).
