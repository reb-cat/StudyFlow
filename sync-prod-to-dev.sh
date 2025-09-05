#!/bin/bash
# Complete Production → Development Database Sync
# This will replace ALL development data with production data

echo "🔄 Starting Production → Development sync..."

# Production URL
PROD_URL="postgresql://neondb_owner:npg_OZch3Xa8GQps@ep-wispy-rain-a58t66kd.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Development URL  
DEV_URL="postgresql://neondb_owner:npg_sDmNKM0voG8x@ep-spring-cloud-ael9rdcw.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

echo "📤 Step 1: Exporting production database..."
pg_dump "$PROD_URL" > prod_complete_backup.sql

echo "🗑️ Step 2: Clearing development database..."
psql "$DEV_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "📥 Step 3: Importing production data to development..."
psql "$DEV_URL" < prod_complete_backup.sql

echo "🔒 Step 4: Restoring RLS policies..."
psql "$DEV_URL" < rls-implementation.sql

echo "🧹 Step 5: Cleaning up backup file..."
rm prod_complete_backup.sql

echo "✅ Sync complete! Development now matches production exactly."