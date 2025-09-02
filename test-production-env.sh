#!/bin/bash

# Production Environment Testing Script
# Tests local app with production database and production-like settings

echo "🧪 PRODUCTION ENVIRONMENT TESTING"
echo "=================================="
echo ""

# Set production-like environment variables
export NODE_ENV=production
export DATABASE_URL="postgresql://neondb_owner:npg_OZch3Xa8GQps@ep-wispy-rain-a58t66kd.us-east-2.aws.neon.tech/neondb?sslmode=require"

echo "📊 Testing database connection..."
PGPASSWORD="npg_OZch3Xa8GQps" psql -h ep-wispy-rain-a58t66kd.us-east-2.aws.neon.tech -U neondb_owner -d neondb -c "SELECT COUNT(*) FROM assignments;" -q

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

echo ""
echo "🚀 Starting local app with production settings..."
echo "   - NODE_ENV=production"
echo "   - Production database"
echo "   - Production session config"
echo ""
echo "Once started, test with:"
echo "  curl -c prod-cookies.txt -X POST -H 'Content-Type: application/json' -d '{\"password\":\"$FAMILY_PASSWORD\"}' http://localhost:5000/api/unlock"
echo "  curl -b prod-cookies.txt http://localhost:5000/api/auth/status"
echo ""

# Start the app with production settings
npm run dev