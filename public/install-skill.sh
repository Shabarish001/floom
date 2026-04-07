#!/bin/bash
# Install the floom Claude Code skill (lightweight: downloads SKILL.md only)
# Usage: curl -s https://dashboard.floom.dev/install-skill.sh | bash -s -- https://dashboard.floom.dev
set -e

DASHBOARD_URL="${1:-https://dashboard.floom.dev}"
SKILL_DIR="$HOME/.claude/skills/floom"
RAW_BASE="https://raw.githubusercontent.com/floomhq/floom/main/skills/floom"
FILES="SKILL.md preflight.py check_protocol.py check_secrets.py upload.py"

mkdir -p "$SKILL_DIR"

for file in $FILES; do
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$RAW_BASE/$file" -o "$SKILL_DIR/$file"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$SKILL_DIR/$file" "$RAW_BASE/$file"
  else
    echo "Error: curl or wget required" >&2
    exit 1
  fi
done

echo ""
echo "floom skill installed to $SKILL_DIR/SKILL.md"
echo ""
echo "Next steps:"
echo "  1. Get your API key from $DASHBOARD_URL/settings"
echo "  2. Open Claude Code and type /floom"
echo "  3. It will walk you through configuring your key"
echo ""
