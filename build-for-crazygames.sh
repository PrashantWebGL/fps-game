#!/bin/bash

# CrazyGames Submission Build Script
# This script builds your game and creates a submission-ready ZIP file

set -e  # Exit on error

echo "🎮 Building Epic Shooter 3D for CrazyGames submission..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -f epic-shooter-3d-crazygames.zip

# Step 2: Install dependencies (if needed)
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Step 3: Build production version
echo "🔨 Building production version..."
npm run build

# Step 4: Check build size
echo ""
echo "📊 Build Statistics:"
echo "==================="

TOTAL_SIZE=$(du -sh dist/ | cut -f1)
FILE_COUNT=$(find dist/ -type f | wc -l | tr -d ' ')
INDEX_SIZE=$(ls -lh dist/index.html | awk '{print $5}')

echo "Total Size: $TOTAL_SIZE"
echo "File Count: $FILE_COUNT"
echo "Index HTML: $INDEX_SIZE"
echo ""

# Step 5: Check requirements
echo "✅ Checking CrazyGames Requirements:"
echo "===================================="

# Check total size (should be < 250MB)
TOTAL_SIZE_MB=$(du -sm dist/ | cut -f1)
if [ $TOTAL_SIZE_MB -lt 250 ]; then
    echo -e "${GREEN}✓${NC} Total size ($TOTAL_SIZE_MB MB) is under 250MB limit"
else
    echo -e "${RED}✗${NC} Total size ($TOTAL_SIZE_MB MB) exceeds 250MB limit!"
fi

# Check file count (should be < 1500)
if [ $FILE_COUNT -lt 1500 ]; then
    echo -e "${GREEN}✓${NC} File count ($FILE_COUNT) is under 1500 limit"
else
    echo -e "${RED}✗${NC} File count ($FILE_COUNT) exceeds 1500 limit!"
fi

# Check initial download size (should be < 50MB for desktop, < 20MB for mobile homepage)
if [ $TOTAL_SIZE_MB -lt 50 ]; then
    echo -e "${GREEN}✓${NC} Initial download size ($TOTAL_SIZE_MB MB) is under 50MB (desktop eligible)"
    if [ $TOTAL_SIZE_MB -lt 20 ]; then
        echo -e "${GREEN}✓${NC} Size is under 20MB (mobile homepage eligible)"
    else
        echo -e "${YELLOW}⚠${NC} Size is over 20MB (not eligible for mobile homepage)"
    fi
else
    echo -e "${YELLOW}⚠${NC} Initial download size ($TOTAL_SIZE_MB MB) exceeds 50MB recommendation"
fi

echo ""

# Step 6: Create submission ZIP
echo "📦 Creating submission ZIP file..."
cd dist
zip -r -q ../epic-shooter-3d-crazygames.zip .
cd ..

ZIP_SIZE=$(ls -lh epic-shooter-3d-crazygames.zip | awk '{print $5}')
echo -e "${GREEN}✓${NC} Created: epic-shooter-3d-crazygames.zip ($ZIP_SIZE)"
echo ""

# Step 7: Summary
echo "🎉 Build Complete!"
echo "=================="
echo ""
echo "Next Steps:"
echo "1. Test the build locally:"
echo "   npm run preview"
echo ""
echo "2. Upload to CrazyGames:"
echo "   - Go to https://developer.crazygames.com/"
echo "   - Click 'Submit Game'"
echo "   - Upload: epic-shooter-3d-crazygames.zip"
echo ""
echo "3. Prepare these for submission:"
echo "   - Game title: Epic Shooter 3D"
echo "   - Description (see CRAZYGAMES_SUBMISSION.md)"
echo "   - 5-10 screenshots"
echo "   - Tags: fps, shooter, 3d, action, survival"
echo ""
echo "📖 Full guide: CRAZYGAMES_SUBMISSION.md"
echo ""
