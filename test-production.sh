#!/bin/bash
# Save your normal database URL
export OLD_DATABASE_URL=$DATABASE_URL

# Use production database
export DATABASE_URL="paste_your_production_database_url_here"

# Tell the app to act like production
export NODE_ENV="production"

# Start the server
npm start