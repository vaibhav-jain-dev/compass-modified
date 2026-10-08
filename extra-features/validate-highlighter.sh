#!/usr/bin/env bash
# Fast check of a highlighter.yaml. Run after every edit:
#   extra-features/validate-highlighter.sh            # ~/compass-highlighter/highlighter.yaml
#   extra-features/validate-highlighter.sh path.yaml  # any file
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$repo/packages/compass-highlighter/scripts/validate.js" "$@"
