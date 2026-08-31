# Agent CLI Deployment Guide

## 🚀 Deploy to Render

### Method 1: Using render.yaml (Automatic)

1. **Push render.yaml to GitHub:**
```bash
git add render.yaml Dockerfile
git commit -m "feat: add Render deployment config"
git push origin main
```

2. **Connect to Render:**
   - Go to: https://dashboard.render.com/
   - Click "New +" → "Blueprint"
   - Connect your GitHub repo: `paxni12345-web/agent-cli`
   - Render will automatically detect `render.yaml`

3. **Set Environment Variables:**
   - `ANTHROPIC_API_KEY` - Your Anthropic API key
   - `OPENAI_API_KEY` - Your OpenAI API key (optional)
   - `NODE_ENV=production`
   - `PORT=3000`

4. **Deploy!**
   - Click "Apply"
   - Wait for build to complete
   - Your app will be live at: `https://agent-cli.onrender.com`

---

### Method 2: Manual Setup

1. **Go to Render Dashboard:**
   - https://dashboard.render.com/

2. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect GitHub: `paxni12345-web/agent-cli`

3. **Configure Service:**
   - **Name:** `agent-cli`
   - **Runtime:** `Docker`
   - **Branch:** `main`
   - **Docker Command:** (leave empty, uses Dockerfile CMD)
   - **Health Check Path:** `/api/health`

4. **Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   ANTHROPIC_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here (optional)
   ```

5. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment

---

## 🔧 Configuration Details

### render.yaml Explained
```yaml
services:
  - type: web              # Web service (HTTP)
    name: agent-cli        # Service name
    runtime: docker        # Use Docker
    repo: your-repo-url    # GitHub repo
    branch: main           # Deploy from main
    dockerfilePath: ./Dockerfile
    envVars:               # Environment variables
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: ANTHROPIC_API_KEY
        sync: false        # Must be set manually (secret)
    healthCheckPath: /api/health  # Health check endpoint
    autoDeploy: true       # Auto-deploy on git push
```

### Dockerfile Stages
1. **Builder:** Compiles TypeScript
2. **Production:** Minimal image with only runtime files
3. **Development:** Full dev environment (not used in Render)

---

## 📊 Available Endpoints

After deployment, your service will have:

- **Web UI:** `https://your-app.onrender.com/`
- **Chat API:** `POST https://your-app.onrender.com/api/chat`
- **Status:** `GET https://your-app.onrender.com/api/status`
- **Health:** `GET https://your-app.onrender.com/api/health`

---

## 🎯 Features on Render

✅ **Auto-deploy:** Pushes to `main` trigger deploys
✅ **Health checks:** Automatic monitoring
✅ **HTTPS:** Free SSL certificate
✅ **CDN:** Global edge network
✅ **Logs:** Real-time logs in dashboard
✅ **Metrics:** CPU, memory, request stats

---

## 💰 Pricing

**Free Tier:**
- 750 hours/month
- 512 MB RAM
- Sleeps after 15 min inactivity
- Good for testing

**Starter ($7/month):**
- Always on
- 512 MB RAM
- Better for production

**Standard ($25/month):**
- 2 GB RAM
- Better performance

---

## 🔍 Troubleshooting

### Build Fails
```bash
# Check logs in Render dashboard
# Common issues:
# - Missing dependencies in package.json
# - TypeScript compilation errors
# - Port not set correctly
```

### App Crashes
```bash
# Check environment variables are set
# Check logs for errors
# Verify API keys are valid
```

### Health Check Fails
```bash
# Endpoint: /api/health
# Should return: { "status": "healthy" }
# Check server.ts health endpoint
```

---

## 🚀 Quick Deploy

```bash
# 1. Add Render config
git add render.yaml Dockerfile
git commit -m "chore: add Render deployment"
git push origin main

# 2. Go to Render Dashboard
# 3. New → Blueprint
# 4. Select repo
# 5. Set ANTHROPIC_API_KEY
# 6. Deploy!
```

---

## 🔗 Useful Links

- Render Dashboard: https://dashboard.render.com/
- Render Docs: https://render.com/docs
- GitHub Repo: https://github.com/paxni12345-web/agent-cli
- Live Site: https://paxni12345-web.github.io/agent-cli/

---

## ✅ Deployment Checklist

- [ ] `render.yaml` created
- [ ] Dockerfile uses `server.js`
- [ ] Environment variables ready
- [ ] GitHub repo connected
- [ ] Health check endpoint works
- [ ] Push to GitHub
- [ ] Create Render service
- [ ] Set environment variables
- [ ] Wait for build
- [ ] Test live URL
- [ ] Check logs

---

**Your app will be live in ~5 minutes! 🎉**
