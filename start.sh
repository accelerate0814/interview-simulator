#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/backend"

if [ ! -f ".env" ]; then
  echo "⚠️  .env not found. Creating from template..."
  cp .env.example .env
  echo "✅ Created backend/.env — please add your API key, then re-run this script."
  exit 1
fi

if [ ! -d "venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate

echo "📥 Installing dependencies..."
pip install -r requirements.txt -q

echo ""
echo "================================================"
echo "  Interview Simulator running at:"
echo "  http://localhost:8000"
echo "================================================"
echo "  Press Ctrl+C to stop"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
