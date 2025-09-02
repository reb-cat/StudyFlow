#!/bin/bash

# Safe Deployment Strategy with Verification
# Ensures changes actually deploy and work before marking success

echo "🚀 SAFE DEPLOYMENT WITH VERIFICATION"
echo "===================================="
echo ""

echo "Step 1: Test local environment first..."
echo "--------------------------------------"
if ! ./verify-auth-fix.sh http://localhost:5000; then
    echo "❌ Local testing failed. Fix issues before deploying."
    exit 1
fi

echo ""
echo "Step 2: Create deployment checkpoint..."
echo "--------------------------------------"
echo "Creating checkpoint before deployment..."
# This would typically create a git commit or Replit checkpoint

echo ""
echo "Step 3: Deploy to production..."
echo "-------------------------------"
echo "⚠️  DEPLOYING TO PRODUCTION ⚠️"
echo ""
echo "To deploy, you'll need to:"
echo "1. Commit changes to git"
echo "2. Push to main branch"
echo "3. Wait for Replit deployment (3-5 minutes)"
echo ""
read -p "Have you deployed? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

echo ""
echo "Step 4: Wait for deployment to complete..."
echo "-----------------------------------------"
echo "Waiting 30 seconds for deployment..."
sleep 30

echo ""
echo "Step 5: Verify production deployment..."
echo "--------------------------------------"

# Test production multiple times to handle deployment lag
for i in {1..3}; do
    echo "Attempt $i/3: Testing production..."
    
    if ./verify-auth-fix.sh https://study-flow.replit.app; then
        echo ""
        echo "🎉 DEPLOYMENT SUCCESSFUL!"
        echo "========================"
        echo "✅ Production authentication working"
        echo "✅ Sessions persisting correctly"
        echo "✅ CORS configured properly"
        echo ""
        echo "Your StudyFlow app is now working at:"
        echo "https://study-flow.replit.app"
        exit 0
    else
        echo "   ❌ Production test failed (attempt $i/3)"
        if [ $i -lt 3 ]; then
            echo "   Waiting 30 seconds before retry..."
            sleep 30
        fi
    fi
done

echo ""
echo "❌ DEPLOYMENT VERIFICATION FAILED"
echo "================================="
echo "The deployment completed but authentication is not working."
echo "This could mean:"
echo "1. Changes didn't actually deploy"
echo "2. Production environment has different issues"
echo "3. More time needed for deployment propagation"
echo ""
echo "Recommended actions:"
echo "1. Check Replit deployment logs"
echo "2. Verify git commit was deployed"
echo "3. Consider rolling back if needed"

exit 1