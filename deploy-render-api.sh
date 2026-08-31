#!/bin/bash
# Auto-deploy to Render using API

RENDER_API_KEY="${RENDER_API_KEY}"
REPO_URL="https://github.com/paxni12345-web/agent-cli"

if [ -z "$RENDER_API_KEY" ]; then
  echo "❌ RENDER_API_KEY not set"
  echo "Get your API key from: https://dashboard.render.com/u/settings#api-keys"
  echo ""
  echo "Then run:"
  echo "export RENDER_API_KEY='your_key_here'"
  echo "./deploy-render.sh"
  exit 1
fi

echo "🚀 Creating Render service..."

# Create service via API
curl -X POST "https://api.render.com/v1/services" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"web_service\",
    \"name\": \"agent-cli\",
    \"repo\": \"$REPO_URL\",
    \"branch\": \"main\",
    \"runtime\": \"docker\",
    \"dockerfilePath\": \"./Dockerfile\",
    \"autoDeploy\": \"yes\",
    \"envVars\": [
      {
        \"key\": \"NODE_ENV\",
        \"value\": \"production\"
      },
      {
        \"key\": \"PORT\",
        \"value\": \"3000\"
      }
    ],
    \"healthCheckPath\": \"/api/health\"
  }" | jq '.'

echo ""
echo "✅ Service created!"
echo "📝 Don't forget to add ANTHROPIC_API_KEY in Render dashboard"
echo "🌐 Dashboard: https://dashboard.render.com/"
