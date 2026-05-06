#!/usr/bin/env bash
#
# install-openclaw.sh - Install openclaw and test skills in a macOS VM
#
# This script is designed to run inside a Lume macOS VM (user: lume).
# It can be executed directly via SSH or uploaded and run by cua-setup.ts.
#
# Usage:
#   ./install-openclaw.sh             # Full install
#   ./install-openclaw.sh --skip-brew # Skip Homebrew install
#   ./install-openclaw.sh --help      # Show help
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HOMEBREW_PREFIX="/opt/homebrew"
OPENCLAW_SKILLS_DIR="$HOME/.openclaw/skills"
SAMPLE_SKILLS_DIR="$HOME/.openclaw/sample-skills"
LOG_FILE="/tmp/install-openclaw.log"

SKIP_BREW=false

# Colors (if stdout is a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log()  { echo -e "${BLUE}[install]${NC} $*"; }
ok()   { echo -e "${GREEN}[  ok  ]${NC} $*"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $*"; }
fail() { echo -e "${RED}[FAILED]${NC} $*" >&2; exit 1; }

run_logged() {
  "$@" >> "$LOG_FILE" 2>&1
}

check_macos() {
  if [[ "$(uname)" != "Darwin" ]]; then
    fail "This script must be run on macOS."
  fi
  ok "Running on macOS $(sw_vers -productVersion) ($(uname -m))"
}

# ---------------------------------------------------------------------------
# Step 1: Install Homebrew
# ---------------------------------------------------------------------------

install_homebrew() {
  if "$SKIP_BREW"; then
    log "Skipping Homebrew install (--skip-brew)"
    return
  fi

  if command -v brew &>/dev/null; then
    ok "Homebrew already installed: $(brew --version | head -1)"
    return
  fi

  log "Installing Homebrew..."
  NONINTERACTIVE=1 /bin/bash -c \
    "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    >> "$LOG_FILE" 2>&1

  # Add to shell profile for Apple Silicon
  if [[ -d "$HOMEBREW_PREFIX" ]]; then
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
    eval "$($HOMEBREW_PREFIX/bin/brew shellenv)"
  fi

  ok "Homebrew installed: $(brew --version | head -1)"
}

# ---------------------------------------------------------------------------
# Step 2: Install openclaw
# ---------------------------------------------------------------------------

install_openclaw() {
  # Ensure PATH includes Homebrew
  export PATH="$HOMEBREW_PREFIX/bin:$PATH"

  if command -v openclaw &>/dev/null; then
    ok "openclaw already installed: $(openclaw --version 2>/dev/null || echo 'version unknown')"
    return
  fi

  log "Installing openclaw..."

  # Try Homebrew tap first, then pip, then npm
  if command -v brew &>/dev/null; then
    if brew install openclaw >> "$LOG_FILE" 2>&1; then
      ok "openclaw installed via Homebrew"
      return
    fi
    warn "Homebrew install failed, trying pip..."
  fi

  # Try pip3 (included with macOS or Homebrew python)
  if command -v pip3 &>/dev/null; then
    if pip3 install openclaw >> "$LOG_FILE" 2>&1; then
      ok "openclaw installed via pip3"
      return
    fi
    warn "pip3 install failed, trying npm..."
  fi

  # Try npm as last resort
  if command -v npm &>/dev/null; then
    if npm install -g openclaw >> "$LOG_FILE" 2>&1; then
      ok "openclaw installed via npm"
      return
    fi
  fi

  warn "Could not install openclaw via package managers."
  warn "You may need to install it manually. See the install log: $LOG_FILE"
}

# ---------------------------------------------------------------------------
# Step 3: Create test skill directories
# ---------------------------------------------------------------------------

create_skill_dirs() {
  log "Creating skill directories..."

  mkdir -p "$OPENCLAW_SKILLS_DIR"
  mkdir -p "$SAMPLE_SKILLS_DIR"
  mkdir -p "$HOME/.openclaw/logs"
  mkdir -p "$HOME/.openclaw/config"

  ok "Skill directories created at $OPENCLAW_SKILLS_DIR"
}

# ---------------------------------------------------------------------------
# Step 4: Install sample skills
# ---------------------------------------------------------------------------

install_sample_skills() {
  log "Installing sample skills..."

  # --- file-organizer skill ---
  local skill_dir="$SAMPLE_SKILLS_DIR/file-organizer"
  mkdir -p "$skill_dir"
  cat > "$skill_dir/SKILL.md" << 'EOF'
# file-organizer

Organizes files in a directory by type.

## Instructions

You are a file organization assistant. When asked to organize files:
1. List all files in the specified directory
2. Create subdirectories by file type (documents, images, code, etc.)
3. Move files into the appropriate subdirectories
4. Report what was organized

Always confirm before moving files.
EOF
  cat > "$skill_dir/metadata.json" << 'EOF'
{
  "name": "file-organizer",
  "description": "Organizes files in a directory by type",
  "version": "1.0.0",
  "type": "sample"
}
EOF

  # --- system-auditor skill ---
  skill_dir="$SAMPLE_SKILLS_DIR/system-auditor"
  mkdir -p "$skill_dir"
  cat > "$skill_dir/SKILL.md" << 'EOF'
# system-auditor

Audits system configuration and reports findings.

## Instructions

You are a system auditor. When asked to audit:
1. Check installed software versions
2. Review system preferences
3. Check security settings (FileVault, Firewall, Gatekeeper)
4. List running services
5. Check disk usage
6. Report findings in a structured format

Never modify system settings - only report.
EOF
  cat > "$skill_dir/metadata.json" << 'EOF'
{
  "name": "system-auditor",
  "description": "Audits system configuration and reports findings",
  "version": "1.0.0",
  "type": "sample"
}
EOF

  # --- web-researcher skill ---
  skill_dir="$SAMPLE_SKILLS_DIR/web-researcher"
  mkdir -p "$skill_dir"
  cat > "$skill_dir/SKILL.md" << 'EOF'
# web-researcher

Searches the web and summarizes findings.

## Instructions

You are a web research assistant. When asked to research a topic:
1. Open Safari or the default browser
2. Navigate to a search engine
3. Search for the specified topic
4. Visit the top 3 results
5. Summarize key findings

Always cite your sources.
EOF
  cat > "$skill_dir/metadata.json" << 'EOF'
{
  "name": "web-researcher",
  "description": "Searches the web and summarizes findings",
  "version": "1.0.0",
  "type": "sample"
}
EOF

  # --- terminal-helper skill ---
  skill_dir="$SAMPLE_SKILLS_DIR/terminal-helper"
  mkdir -p "$skill_dir"
  cat > "$skill_dir/SKILL.md" << 'EOF'
# terminal-helper

Assists with terminal commands and scripting.

## Instructions

You are a terminal assistant. When asked for help:
1. Understand what the user wants to accomplish
2. Suggest the appropriate terminal commands
3. Explain what each command does
4. Execute commands when asked

Be careful with destructive operations (rm, mv with overwrite).
Always explain before executing.
EOF
  cat > "$skill_dir/metadata.json" << 'EOF'
{
  "name": "terminal-helper",
  "description": "Assists with terminal commands and scripting",
  "version": "1.0.0",
  "type": "sample"
}
EOF

  local count
  count=$(find "$SAMPLE_SKILLS_DIR" -maxdepth 1 -type d | wc -l)
  count=$((count - 1))
  ok "$count sample skills installed in $SAMPLE_SKILLS_DIR"
}

# ---------------------------------------------------------------------------
# Step 5: Verify installation
# ---------------------------------------------------------------------------

verify_install() {
  log "Verifying installation..."

  local checks_passed=0
  local checks_failed=0

  # Check Homebrew
  if command -v brew &>/dev/null; then
    ok "Homebrew: $(brew --version | head -1)"
    ((checks_passed++))
  else
    warn "Homebrew: not found"
    ((checks_failed++))
  fi

  # Check openclaw
  if command -v openclaw &>/dev/null; then
    ok "openclaw: $(openclaw --version 2>/dev/null || echo 'installed')"
    ((checks_passed++))
  else
    warn "openclaw: not found in PATH"
    ((checks_failed++))
  fi

  # Check skill directories
  if [[ -d "$OPENCLAW_SKILLS_DIR" ]]; then
    ok "Skills directory: $OPENCLAW_SKILLS_DIR"
    ((checks_passed++))
  else
    warn "Skills directory not found"
    ((checks_failed++))
  fi

  # Check sample skills
  if [[ -d "$SAMPLE_SKILLS_DIR" ]]; then
    local skill_count
    skill_count=$(find "$SAMPLE_SKILLS_DIR" -name "SKILL.md" | wc -l | tr -d ' ')
    ok "Sample skills: $skill_count installed"
    ((checks_passed++))
  else
    warn "Sample skills directory not found"
    ((checks_failed++))
  fi

  # Check disk space
  local free_space
  free_space=$(df -h / | tail -1 | awk '{print $4}')
  ok "Free disk space: $free_space"
  ((checks_passed++))

  echo ""
  log "Verification: $checks_passed passed, $checks_failed failed"

  if [[ "$checks_failed" -gt 0 ]]; then
    warn "Some checks failed. Review the install log: $LOG_FILE"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

usage() {
  cat << 'USAGE'
Usage: install-openclaw.sh [OPTIONS]

Install openclaw and test skills in a macOS VM.

Options:
  --skip-brew     Skip Homebrew installation
  --help          Show this help message

This script will:
  1. Install Homebrew (if not present)
  2. Install openclaw via brew/pip/npm
  3. Create skill directories (~/.openclaw/skills/)
  4. Install sample skills (~/.openclaw/sample-skills/)
  5. Verify the installation
USAGE
}

main() {
  # Parse arguments
  for arg in "$@"; do
    case "$arg" in
      --skip-brew)  SKIP_BREW=true ;;
      --help)       usage; exit 0 ;;
      *)            warn "Unknown argument: $arg" ;;
    esac
  done

  echo ""
  echo "============================================================"
  echo "  openclaw Installation Script"
  echo "============================================================"
  echo ""

  # Initialize log
  echo "--- Install started at $(date) ---" > "$LOG_FILE"

  check_macos
  install_homebrew
  install_openclaw
  create_skill_dirs
  install_sample_skills
  verify_install

  echo ""
  echo "============================================================"
  echo "  Installation complete!"
  echo "============================================================"
  echo ""
  echo "  Skills directory:  $OPENCLAW_SKILLS_DIR"
  echo "  Sample skills:     $SAMPLE_SKILLS_DIR"
  echo "  Install log:       $LOG_FILE"
  echo ""
}

main "$@"
