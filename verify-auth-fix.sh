#!/bin/bash

# Automated Authentication Testing Script
# Verifies session authentication works before deployment

BASE_URL="${1:-http://localhost:5000}"
COOKIE_FILE="/tmp/auth_test_cookies.txt"

echo "🧪 AUTHENTICATION VERIFICATION TEST"
echo "=================================="
echo "Testing: $BASE_URL"
echo ""

# Clean up any existing cookies
rm -f "$COOKIE_FILE"

echo "1. Testing login with family password..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: https://study-flow.replit.app" \
  -d "{\"password\":\"$FAMILY_PASSWORD\"}" \
  "$BASE_URL/api/unlock")

echo "   Response: $LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ Login successful"
else
    echo "   ❌ Login failed"
    exit 1
fi

echo ""
echo "2. Testing session persistence..."
AUTH_STATUS=$(curl -s -b "$COOKIE_FILE" \
  -H "Origin: https://study-flow.replit.app" \
  "$BASE_URL/api/auth/status")

echo "   Response: $AUTH_STATUS"

if echo "$AUTH_STATUS" | grep -q '"authenticated":true'; then
    echo "   ✅ Session persists correctly"
else
    echo "   ❌ Session does not persist"
    echo "   Cookie file contents:"
    cat "$COOKIE_FILE" 2>/dev/null || echo "   No cookies found"
    exit 1
fi

echo ""
echo "3. Testing protected endpoint access..."
ASSIGNMENTS_RESPONSE=$(curl -s -b "$COOKIE_FILE" \
  -H "Origin: https://study-flow.replit.app" \
  "$BASE_URL/api/assignments?studentName=abigail")

if echo "$ASSIGNMENTS_RESPONSE" | grep -q "title"; then
    echo "   ✅ Protected endpoints accessible"
    echo "   Found $(echo "$ASSIGNMENTS_RESPONSE" | jq '. | length' 2>/dev/null || echo "N/A") assignments"
else
    echo "   ❌ Protected endpoints not accessible"
    echo "   Response: $ASSIGNMENTS_RESPONSE"
    exit 1
fi

echo ""
echo "4. Testing CORS headers..."
CORS_HEADERS=$(curl -s -i -H "Origin: https://study-flow.replit.app" "$BASE_URL/api/auth/status" | grep -i "access-control")
echo "   CORS Headers:"
echo "$CORS_HEADERS" | sed 's/^/     /'

if echo "$CORS_HEADERS" | grep -q "access-control-allow-origin: https://study-flow.replit.app"; then
    echo "   ✅ CORS configured correctly (specific origin)"
elif echo "$CORS_HEADERS" | grep -q "access-control-allow-origin: \*"; then
    echo "   ⚠️ CORS using wildcard (will break with credentials)"
    exit 1
else
    echo "   ❌ CORS not configured"
    exit 1
fi

if echo "$CORS_HEADERS" | grep -q "access-control-allow-credentials: true"; then
    echo "   ✅ Credentials allowed"
else
    echo "   ❌ Credentials not allowed"
    exit 1
fi

echo ""
echo "🎉 ALL TESTS PASSED! Authentication is working correctly."
echo ""
echo "Ready for deployment:"
echo "- ✅ Login works"
echo "- ✅ Sessions persist"
echo "- ✅ Protected endpoints accessible"
echo "- ✅ CORS configured correctly"

# Clean up
rm -f "$COOKIE_FILE"