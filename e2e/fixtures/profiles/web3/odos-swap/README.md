# odos-mcp-skills

Markdown skills for agents that have **local tool access** (bash, `curl`, `jq`,
Foundry's `cast`). Use these when running inside Claude Code, Cowork, Cursor,
or any environment where the agent can shell out — there's no server to
install and no MCP transport to configure.

For hosted/web agents that can't run shell commands, use the MCP server
in the sibling `odos-mcp-ts/` or `odos-mcp-py/` packages instead.

## Layout

```
SKILL.md                       Top-level guidance + safety
skills/
  odos-quote.md                Get a swap quote
  odos-multi-asset-swap.md     N tokens → 1 token, single tx (Odos signature feature)
  odos-swap.md                 Execute a swap (with confirmation pattern)
  odos-zap.md                  LP zap (deposit / withdraw)
  odos-path-viz.md             Inspect the route Odos picked
  odos-pricing.md              Token pricing lookup
```

## Install

Drop the folder into wherever your agent looks for skills. For Claude Code or
Cowork:

```bash
mkdir -p ~/.claude/skills
cp -r odos-mcp-skills/skills/* ~/.claude/skills/
cp odos-mcp-skills/SKILL.md ~/.claude/skills/odos-mcp-skills.md
```

For Cursor / VS Code agents, point your skill loader at `odos-mcp-skills/`
or paste individual skill bodies into the agent's system prompt.

## Required local tools

- `curl` — HTTP calls to `api.odos.xyz`
- `jq` — JSON parsing
- `cast` (from [Foundry](https://book.getfoundry.sh/)) — only needed for
  execution skills (`odos-swap`, `odos-zap`, anything that signs/broadcasts)

## Required environment

| Var | When | Purpose |
| --- | --- | --- |
| `ODOS_API_KEY` | Optional | Partner / enterprise API key |
| `RPC_URL` | Execution skills only | Per-chain RPC URL (or pass `--rpc-url` to `cast`) |
| `ODOS_KEYSTORE` | Execution skills preferred | Encrypted Foundry keystore path for signing |
| `ODOS_KEYSTORE_PASSWORD_FILE` | Execution skills preferred | Password file for the keystore |

Execution skills build `SIGNER_ARGS` from the keystore by default. A raw
`PRIVATE_KEY` is documented only as a last-resort fallback because child
processes inherit exported environment variables.

## Why a Skills package alongside the MCP server?

Different deployment shapes for different agents:

- **MCP server** = tool calls with structured schemas, validated args,
  protocol-level safety latches, centralized retry/cache/observability.
  Right for hosted agents and complex multi-step automation.
- **Skills** = procedural markdown the agent reads and executes through its
  own shell. Right for local agents where install/hosting friction matters
  more than wrapper polish.

Both wrap the same Odos v3 API. Pick whichever fits the agent host.
