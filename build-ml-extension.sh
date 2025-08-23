#!/bin/bash

# Build script for the ML Extension
# This script builds both the scratch-vm (with extension) and scratch-gui

echo "🚀 Building ML Extension for Scratch..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    echo "❌ Error: Please run this script from the scratch-editor directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build scratch-vm (includes the extension)
echo "🔧 Building scratch-vm..."
cd packages/scratch-vm
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to build scratch-vm"
    exit 1
fi

echo "✅ scratch-vm built successfully"

# Build scratch-gui
echo "🎨 Building scratch-gui..."
cd ../scratch-gui
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to build scratch-gui"
    exit 1
fi

echo "✅ scratch-gui built successfully"

# Return to root
cd ../..

echo ""
echo "🎉 ML Extension build completed successfully!"
echo ""
echo "To test the extension:"
echo "1. Open test-ml-extension.html in your browser"
echo "2. Or start the development server: cd packages/scratch-gui && npm start"
echo ""
echo "Make sure your backend API is running and accessible!"
