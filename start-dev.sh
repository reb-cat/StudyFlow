#!/bin/bash

# Auto-restart development server script
echo "🚀 Starting StudyFlow development server with auto-restart..."
echo "📁 Watching: server/, shared/ directories"
echo "🔄 Will restart automatically on file changes"
echo "=============================================="

NODE_ENV=development npx tsx --watch server/index.ts