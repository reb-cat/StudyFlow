#!/bin/bash
# Production build script for StudyFlow
set -e

echo "🏗️  Building StudyFlow for production..."

# Build the client
echo "📦 Building client..."
npm run build

# Ensure server/public directory exists and copy built assets
echo "📂 Copying assets to expected location..."
mkdir -p server/public
cp -r dist/public/* server/public/

echo "✅ Production build complete!"
echo "🚀 To start in production mode:"
echo "   APP_ENV=production node dist/index.js"