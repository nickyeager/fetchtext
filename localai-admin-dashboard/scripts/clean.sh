#!/usr/bin/env bash
set -euo pipefail

# Remove generated artifacts and transient files
targets=(
  "dist" \
  "playwright-report" \
  "test-results" \
  "htmlcov" \
  "coverage" \
  "coverage.xml" \
  ".coverage" \
  ".pw-results.json" \
  ".pw-run.json" \
  ".pw.xml" \
  ".auth-preview.log" \
  ".auth-preview.pid" \
  ".preview.log" \
  ".preview.pid" \
  "current-ui-state.png" \
  "no-file-input-found.png" \
  "debug-ui-state.png"
)

for t in "${targets[@]}"; do
  if [ -e "$t" ]; then
    chmod -R u+w "$t" 2>/dev/null || true
    chflags -R nouchg "$t" 2>/dev/null || true
    rm -rf "$t" || true
  fi
done

echo "✅ Clean complete."
