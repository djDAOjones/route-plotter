#!/usr/bin/env bash
#
# build.sh — one-shot production rebuild of Route Plotter into docs/.
#
# Wraps `npm run build` so it runs from any directory, with an optional --test
# flag to also run the suite (the project's "build + test after every change"
# convention). Does not start a server — use restart.sh for that.
#
# Usage:
#   ./scripts/build.sh           # production build into docs/
#   ./scripts/build.sh --test    # build, then run the test suite
#   ./scripts/build.sh --help
#
# If the executable bit is lost (e.g. via OneDrive sync), run it with:
#   bash scripts/build.sh

set -euo pipefail

# Resolve the project root (this script lives in <root>/scripts).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

RUN_TESTS=false

usage() {
  cat <<EOF
build.sh — production rebuild of Route Plotter into docs/

Usage:
  ./scripts/build.sh         Production build (minified) into docs/
  ./scripts/build.sh --test  Build, then run the test suite (npm test)
  ./scripts/build.sh --help  Show this help
EOF
}

for arg in "$@"; do
  case "${arg}" in
    --test) RUN_TESTS=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: ${arg}" >&2; usage; exit 1 ;;
  esac
done

cd "${ROOT_DIR}"

echo "📦 Building (npm run build)…"
npm run build

if [[ "${RUN_TESTS}" == true ]]; then
  echo ""
  echo "🧪 Running tests (npm test)…"
  npm test
fi

echo ""
echo "✅ Done."
