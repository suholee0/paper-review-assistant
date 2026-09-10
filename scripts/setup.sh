#!/bin/bash
set -e

echo "=== Paper Review Tool Setup ==="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required. Install from https://nodejs.org/"
  exit 1
fi

node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Node.js 22+ is required."); process.exit(1); }'
echo "Node.js $(node --version)"

# Install dependencies
echo "Installing dependencies..."
npm ci

# Initialize database
echo "Setting up database..."
npx prisma db push

echo ""
echo "Setup complete! Start with:"
echo "  npx --no-install codex login"
echo "  npx --no-install codex"
echo "  > 이 논문 같이 읽자: https://arxiv.org/abs/1706.03762"
