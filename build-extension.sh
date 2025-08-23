#!/bin/bash

echo "========================================"
echo "   Cogix Browser Extension Builder"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed!${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[1/4] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to install dependencies${NC}"
    exit 1
fi

echo ""
echo "[2/4] Generating icons..."
npm run generate:icons
# Icon generation might fail if canvas is not installed, but we can continue

echo ""
echo "[3/4] Building extension..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Build failed${NC}"
    exit 1
fi

echo ""
echo "[4/4] Build complete!"
echo ""
echo -e "${GREEN}========================================"
echo "   Extension built successfully!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Open Chrome and go to: chrome://extensions/"
echo "2. Enable \"Developer mode\" (top right)"
echo "3. Click \"Load unpacked\""
echo "4. Select the \"dist\" folder from this directory"
echo ""
echo -e "The extension is ready in: ${GREEN}$(pwd)/dist${NC}"
echo ""