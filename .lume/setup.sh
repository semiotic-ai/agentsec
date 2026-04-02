#!/usr/bin/env bash
#
# .lume/setup.sh -- Install Lume CLI, provision a macOS VM, and bootstrap
# the agent-audit test environment inside it.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LUMEFILE="$SCRIPT_DIR/Lumefile"

# ---------------------------------------------------------------------------
# Configuration (override via environment)
# ---------------------------------------------------------------------------
VM_NAME="${LUME_VM_NAME:-agent-audit-vm}"
VM_CPU="${LUME_VM_CPU:-4}"
VM_MEMORY="${LUME_VM_MEMORY:-8GB}"
VM_DISK="${LUME_VM_DISK:-50GB}"
VM_DISPLAY="${LUME_VM_DISPLAY:-1024x768}"
LUME_API="${LUME_API_URL:-http://localhost:7777}"
SSH_USER="${LUME_SSH_USER:-lume}"
SSH_PASS="${LUME_SSH_PASS:-lume}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { printf '\033[1;34m[lume-setup]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[lume-setup]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[lume-setup]\033[0m %s\n' "$*" >&2; }
die()   { error "$@"; exit 1; }

check_apple_silicon() {
  if [[ "$(uname -m)" != "arm64" ]]; then
    die "Lume requires Apple Silicon (arm64). Detected: $(uname -m)"
  fi
}

wait_for_provisioning() {
  local vm="$1"
  local max_polls=60          # 60 x 30s = 30 minutes
  local poll_interval=30

  info "VM '$vm' is still being provisioned (ipsw_install). Waiting up to 30 minutes..."
  for i in $(seq 1 "$max_polls"); do
    local status
    status="$(lume ls 2>/dev/null | grep "$vm" || true)"

    if [[ -z "$status" ]]; then
      die "VM '$vm' disappeared while waiting for provisioning."
    fi

    if echo "$status" | grep -qi "provisioning\|ipsw_install"; then
      local elapsed=$(( i * poll_interval ))
      info "  Still provisioning... (${elapsed}s elapsed, polling every ${poll_interval}s)"
      sleep "$poll_interval"
    else
      info "VM '$vm' provisioning complete."
      return 0
    fi
  done

  die "VM '$vm' is still provisioning after 30 minutes. Check 'lume ls' manually."
}

# ---------------------------------------------------------------------------
# 1. Install Lume CLI
# ---------------------------------------------------------------------------
install_lume() {
  if command -v lume &>/dev/null; then
    info "Lume is already installed: $(lume --version)"
    return 0
  fi

  info "Installing Lume CLI..."

  # Prefer Homebrew if available
  if command -v brew &>/dev/null; then
    info "Installing via Homebrew..."
    brew tap trycua/lume 2>/dev/null || true
    brew install lume
  else
    info "Installing via curl (Homebrew not found)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/lume/scripts/install.sh)"
  fi

  # Ensure ~/.local/bin is on PATH for this session
  if ! command -v lume &>/dev/null; then
    export PATH="$PATH:$HOME/.local/bin"
  fi

  if ! command -v lume &>/dev/null; then
    die "Lume installation failed. Please install manually: https://cua.ai/docs/lume/guide/getting-started/installation"
  fi

  info "Lume installed: $(lume --version)"
}

# ---------------------------------------------------------------------------
# 2. Ensure Lume service is running
# ---------------------------------------------------------------------------
ensure_lume_service() {
  info "Checking Lume API at $LUME_API..."
  if curl -sf "$LUME_API/lume/vms" >/dev/null 2>&1; then
    info "Lume API is reachable."
    return 0
  fi

  info "Lume API not reachable. Starting lume serve in background..."
  lume serve &
  LUME_PID=$!

  # Wait up to 15 seconds for the API to come up
  for i in $(seq 1 15); do
    if curl -sf "$LUME_API/lume/vms" >/dev/null 2>&1; then
      info "Lume API is now reachable (pid=$LUME_PID)."
      return 0
    fi
    sleep 1
  done

  die "Lume API did not become reachable within 15 seconds."
}

# ---------------------------------------------------------------------------
# 3. Create / pull the macOS VM
# ---------------------------------------------------------------------------
create_vm() {
  info "Checking for existing VM '$VM_NAME'..."
  local vm_status
  vm_status="$(lume ls 2>/dev/null | grep "$VM_NAME" || true)"

  if [[ -n "$vm_status" ]]; then
    # VM exists -- check if it is still being provisioned
    if echo "$vm_status" | grep -qi "provisioning\|ipsw_install"; then
      wait_for_provisioning "$VM_NAME"
    else
      info "VM '$VM_NAME' already exists. Skipping creation."
    fi
    return 0
  fi

  info "Creating VM '$VM_NAME' (cpu=$VM_CPU, memory=$VM_MEMORY, disk=$VM_DISK)..."

  local lume_dir="$HOME/.lume"
  if [[ -d "$lume_dir" ]] && ls "$lume_dir"/*.ipsw &>/dev/null; then
    info "Using cached macOS restore image from $lume_dir."
  else
    info "This will download a macOS restore image (~15 GB) on first run."
  fi

  local create_args=(
    "$VM_NAME"
    --os macos
    --ipsw latest
    --cpu "$VM_CPU"
    --memory "$VM_MEMORY"
    --disk-size "$VM_DISK"
    --unattended tahoe
  )

  if ! lume create "${create_args[@]}"; then
    warn "First lume create attempt failed. Retrying after cooldown..."
    sleep 5
    if ! lume create "${create_args[@]}"; then
      die "lume create failed after retry. Check logs for details."
    fi
  fi

  info "VM '$VM_NAME' created successfully."
}

# ---------------------------------------------------------------------------
# 4. Start the VM (headless)
# ---------------------------------------------------------------------------
start_vm() {
  info "Starting VM '$VM_NAME' (headless)..."
  lume run "$VM_NAME" --no-display &
  VM_RUN_PID=$!

  info "Waiting for VM to boot and SSH to become available..."
  local max_wait=120
  for i in $(seq 1 "$max_wait"); do
    if lume ssh "$VM_NAME" -u "$SSH_USER" -p "$SSH_PASS" "echo ok" 2>/dev/null | grep -q "ok"; then
      info "VM '$VM_NAME' is ready (SSH accessible)."
      return 0
    fi
    sleep 2
  done

  die "VM '$VM_NAME' did not become SSH-accessible within $((max_wait * 2)) seconds."
}

# ---------------------------------------------------------------------------
# 5. Install openclaw inside the VM
# ---------------------------------------------------------------------------
install_openclaw() {
  info "Installing openclaw inside VM '$VM_NAME'..."

  lume ssh "$VM_NAME" -u "$SSH_USER" -p "$SSH_PASS" -- bash -c '
    set -euo pipefail

    # Install Homebrew if not present
    if ! command -v brew &>/dev/null; then
      echo "Installing Homebrew..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    # Install bun if not present
    if ! command -v bun &>/dev/null; then
      echo "Installing bun..."
      curl -fsSL https://bun.sh/install | bash
      export PATH="$HOME/.bun/bin:$PATH"
    fi

    # Install openclaw globally
    echo "Installing openclaw..."
    bun install -g openclaw || npm install -g openclaw

    echo "openclaw installation complete."
  '

  info "openclaw installed inside VM."
}

# ---------------------------------------------------------------------------
# 6. Copy fixture skills into the VM
# ---------------------------------------------------------------------------
install_fixtures() {
  info "Copying fixture skills into VM '$VM_NAME'..."

  local fixtures_dir="$PROJECT_ROOT/e2e/fixtures"

  if [[ ! -d "$fixtures_dir" ]]; then
    warn "Fixtures directory not found at $fixtures_dir. Skipping."
    return 0
  fi

  # Create a target directory in the VM
  lume ssh "$VM_NAME" -u "$SSH_USER" -p "$SSH_PASS" \
    "mkdir -p ~/test-skills"

  # Copy each fixture skill via shared directory or tar+ssh
  for skill_dir in "$fixtures_dir"/*/; do
    local skill_name
    skill_name="$(basename "$skill_dir")"
    info "  Installing fixture: $skill_name"

    # Pack the fixture into a tarball and pipe it into the VM
    tar -cf - -C "$fixtures_dir" "$skill_name" | \
      lume ssh "$VM_NAME" -u "$SSH_USER" -p "$SSH_PASS" \
        "tar -xf - -C ~/test-skills/"
  done

  info "Fixture skills installed in VM at ~/test-skills/"
}

# ---------------------------------------------------------------------------
# 7. Verify the environment
# ---------------------------------------------------------------------------
verify_environment() {
  info "Verifying test environment inside VM..."

  lume ssh "$VM_NAME" -u "$SSH_USER" -p "$SSH_PASS" -- bash -c '
    set -euo pipefail
    export PATH="$HOME/.bun/bin:/opt/homebrew/bin:$PATH"

    echo "--- macOS version ---"
    sw_vers

    echo "--- bun version ---"
    bun --version || echo "bun not found"

    echo "--- openclaw version ---"
    openclaw --version 2>/dev/null || echo "openclaw not found (may need PATH adjustment)"

    echo "--- installed fixture skills ---"
    ls -1 ~/test-skills/ 2>/dev/null || echo "no fixtures found"

    echo "--- verification complete ---"
  '

  info "Environment verification complete."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  info "=== agent-audit Lume Test Environment Setup ==="
  info ""

  check_apple_silicon
  install_lume
  ensure_lume_service
  create_vm
  start_vm
  install_openclaw
  install_fixtures
  verify_environment

  info ""
  info "=== Setup complete ==="
  info "VM '$VM_NAME' is running and ready for testing."
  info ""
  info "  SSH into the VM:   lume ssh $VM_NAME"
  info "  Stop the VM:       lume stop $VM_NAME"
  info "  Run e2e tests:     cd e2e && bun test"
  info ""
}

main "$@"
