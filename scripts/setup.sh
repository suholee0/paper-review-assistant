#!/bin/bash
set -e

echo "=== Paper Review Tool Setup ==="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required. Install from https://nodejs.org/"
  exit 1
fi

echo "Node.js $(node --version)"

# Install dependencies
echo "Installing dependencies..."
npm install

# Initialize database
echo "Setting up database..."
npx prisma db push

echo ""
echo "Setup complete! Start with:"
echo "  claude"
echo "  > 이 논문 같이 읽자: https://arxiv.org/abs/1706.03762"
