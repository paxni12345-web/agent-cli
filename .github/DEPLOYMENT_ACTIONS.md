# GitHub Actions Auto-Deploy Setup

This project includes GitHub Actions workflows for automatic deployment.

## 🚀 Available Workflows

### 1. **Deploy to Render** (`.github/workflows/deploy-render.yml`)
Automatically deploys to Render.com on every push to `main`.

### 2. **Deploy to Railway** (`.github/workflows/deploy-railway.yml`)
Automatically deploys to Railway.app on every push to `main`.

---

## ⚙️ Setup Instructions

### For Render:

1. **Get Render API Key:**
   - Go to: https://dashboard.render.com/u/settings#api-keys
   - Create new API key

2. **Add to GitHub Secrets:**
   - Go to: https://github.com/paxni12345-web/agent-cli/settings/secrets/actions
   - Add secrets:
     - `RENDER_API_KEY` = your Render API key
     - `ANTHROPIC_API_KEY` = your Anthropic API key

3. **Push to main branch:**
   ```bash
   git push origin main
   ```

4. **Check deployment:**
   - Go to: https://github.com/paxni12345-web/agent-cli/actions
   - Watch the workflow run

---

### For Railway:

1. **Get Railway Token:**
   - Go to: https://railway.app/account/tokens
   - Create new token

2. **Get Project ID:**
   - Create project on Railway first
   - Get project ID from URL or dashboard

3. **Add to GitHub Secrets:**
   - `RAILWAY_TOKEN` = your Railway token
   - `RAILWAY_PROJECT_ID` = your project ID
   - `ANTHROPIC_API_KEY` = your Anthropic API key

4. **Push to main:**
   ```bash
   git push origin main
   ```

---

## 🎯 How It Works

1. You push code to `main` branch
2. GitHub Actions automatically triggers
3. Workflow builds and deploys your app
4. App goes live in ~5 minutes
5. Future pushes auto-deploy

---

## 🔧 Manual Trigger

You can also trigger deployment manually:

1. Go to: https://github.com/paxni12345-web/agent-cli/actions
2. Select workflow (Deploy to Render or Railway)
3. Click "Run workflow"
4. Select `main` branch
5. Click "Run workflow"

---

## 📊 Monitoring

**GitHub Actions:**
- https://github.com/paxni12345-web/agent-cli/actions

**Render Dashboard:**
- https://dashboard.render.com/

**Railway Dashboard:**
- https://railway.app/dashboard

---

## ✅ Benefits

- ✅ Zero-config deployment
- ✅ Auto-deploy on push
- ✅ No CLI setup needed
- ✅ Works from any machine
- ✅ Built-in CI/CD

---

## 🚨 Important Notes

1. **Secrets are required** - Workflow will fail without them
2. **First deployment** creates the service
3. **Subsequent pushes** update existing service
4. **Check Actions tab** for deployment status
5. **Free tier available** on both platforms

---

## 🆘 Troubleshooting

### Workflow fails:
1. Check GitHub Actions logs
2. Verify all secrets are set
3. Check API key is valid
4. Ensure Dockerfile is correct

### Deployment succeeds but app doesn't work:
1. Check service logs in Render/Railway
2. Verify environment variables
3. Check health endpoint: `/api/health`

---

**🎉 Set up once, deploy forever!**
