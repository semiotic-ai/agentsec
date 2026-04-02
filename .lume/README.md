# Lume Test Environment

Isolated macOS VM environment for end-to-end testing of agent-audit.

## Overview

This directory contains the configuration and setup scripts for provisioning
a macOS virtual machine via [Lume](https://cua.ai/docs/lume) (by Cua / trycua).
Lume uses Apple's native Virtualization Framework to run macOS VMs at near-native
speed on Apple Silicon.

The VM is used to:
- Install openclaw (the skill runtime under audit)
- Deploy a set of fixture skills (both well-behaved and intentionally flawed)
- Run `agent-audit` against the VM to verify end-to-end audit behavior

## Requirements

- Apple Silicon Mac (M1/M2/M3/M4)
- macOS 13.0 or later
- 16 GB RAM recommended (8 GB minimum)
- ~60 GB free disk space (VM image + IPSW)
- Lume CLI installed (see below)

## Quick Start

```bash
# 1. Install Lume and provision the VM
.lume/setup.sh

# 2. Run the e2e test suite
cd e2e && bun test
```

## Files

| File | Purpose |
|------|---------|
| `setup.sh` | Installs Lume CLI, pulls a macOS image, provisions the VM |
| `Lumefile` | Declarative VM configuration (name, CPU, memory, disk, etc.) |
| `../e2e/setup.ts` | Programmatic setup: starts VM, installs openclaw + fixtures |
| `../e2e/audit.test.ts` | End-to-end tests that run agent-audit against the VM |
| `../e2e/fixtures/` | Sample skills used as audit targets |

## Lume CLI Reference

```bash
# Create a macOS VM
lume create agent-audit-vm --os macos --ipsw latest --cpu 4 --memory 8GB --disk-size 50GB

# Run headlessly (for CI)
lume run agent-audit-vm --no-display

# SSH into the VM (default user: lume, password: lume)
lume ssh agent-audit-vm

# Execute a command inside the VM
lume ssh agent-audit-vm "sw_vers"

# Stop and delete the VM
lume stop agent-audit-vm
lume delete agent-audit-vm --force
```

## Lume HTTP API

Lume also exposes a local HTTP API on `http://localhost:7777` when the
background service is running (or via `lume serve`). The `e2e/setup.ts`
script uses this API for programmatic VM management.

Key endpoints:
- `GET  /lume/vms` -- list VMs
- `POST /lume/vms` -- create a VM
- `POST /lume/vms/:name/run` -- start a VM
- `POST /lume/vms/:name/stop` -- stop a VM
- `DELETE /lume/vms/:name` -- delete a VM

## Network & SSH

VMs created with `--unattended` have SSH enabled automatically with
credentials `lume`/`lume`. The setup script uses `lume ssh` to bootstrap
the environment inside the VM.

## Troubleshooting

- **lume: command not found** -- Add `~/.local/bin` to your PATH.
- **VM creation hangs** -- Ensure you have enough disk space for the IPSW download (~15 GB).
- **SSH connection refused** -- The VM may still be booting. Wait 30-60 seconds after `lume run`.
- **Virtualization not available** -- Lume requires Apple Silicon. Intel Macs are not supported.
