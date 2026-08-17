#!/bin/bash
# Rebuild project from scratch and serve on port 3000.
# Run from anywhere — automatically resolves to project root.
#
# Steps: kill port 3000 → clean build output → npm install → production
# build → serve docs/ with Python (simplest possible server, no caching).

set -e  # Exit on any error

# Resolve project root (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "📁 Project root: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# 1. Kill any process on port 3000
echo "🔪 Killing processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "   No processes found on port 3000"
sleep 0.5

# 2. Clean previous build output (forces a fully fresh bundle)
echo "🧹 Cleaning build output..."
rm -f docs/app.js docs/app.js.map docs/meta.json
echo "   Removed docs/app.js, app.js.map, meta.json"

# 3. Install/update dependencies (fast no-op if already current)
echo "📦 Checking dependencies..."
npm install --silent

# 4. Production build — writes fresh bundle to docs/
echo "🔨 Building project..."
npm run build

# 5. Verify build output exists
if [ ! -f docs/app.js ]; then
  echo "❌ Build failed — docs/app.js not found"
  exit 1
fi
SIZE=$(wc -c < docs/app.js | tr -d ' ')
echo "✅ Build verified: docs/app.js (${SIZE} bytes)"

# 6. Serve docs/ with Python (simple, no caching, no in-memory builds)
echo "🚀 Serving docs/ on http://localhost:3000"
echo "   Press Ctrl+C to stop"
python3 -m http.server 3000 --directory docs
