# Deployment Guide - Hetzner VPS

This guide covers the setup and deployment of the Daily Dose bot to a Hetzner VPS using GitHub Actions.

## Table of Contents

- [Slack App Setup](#slack-app-setup)
- [Database Setup (Supabase)](#database-setup-supabase)
- [Environment Variables Reference](#environment-variables-reference)
- [VPS Initial Setup](#vps-initial-setup)
- [SSH Key Setup](#ssh-key-setup)
- [Firewall Configuration](#firewall-configuration)
- [Nginx Reverse Proxy](#nginx-reverse-proxy)
- [Deployment Workflow](#deployment-workflow)
- [Manual Deployment Commands](#manual-deployment-commands)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Backup Strategy](#backup-strategy)

---

## Slack App Setup

### 1. Create the Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**.
2. Choose **From an app manifest**.
3. Select your workspace and paste the manifest from `scripts/updateSlackManifest.js` (run `npm run manifest:dry-run` to preview it).

### 2. Required Bot Token Scopes

| Scope | Purpose |
|-------|---------|
| `channels:read` | List public channels |
| `chat:write` | Post messages |
| `commands` | Register slash commands |
| `groups:read` | List private channels |
| `im:write` | Send DMs |
| `users:read` | Look up user info |
| `users:read.email` | Match users by email |

### 3. Required User Token Scopes

| Scope | Purpose |
|-------|---------|
| `channels:read` | Resolve channel names |

### 4. Enable Socket Mode

Daily Dose does **not** use Socket Mode — it uses HTTP endpoints. Make sure **Socket Mode is off** in your app settings.

### 5. Collect Your Tokens

After installing the app to your workspace, collect:

| Token | Where to find it |
|-------|-----------------|
| `SLACK_BOT_TOKEN` | OAuth & Permissions → Bot User OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Basic Information → Signing Secret |
| `SLACK_APP_TOKEN` | Basic Information → App-Level Tokens (create one with `connections:write`) |
| `SLACK_USER_TOKEN` | OAuth & Permissions → User OAuth Token (`xoxp-...`) |

---

## Database Setup (Supabase)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Wait for provisioning to complete.

### 2. Get connection strings

In your Supabase project: **Settings → Database → Connection string**

- **`DATABASE_URL`**: Use the **URI** (pooled connection, port 6543) — used by Prisma at runtime.
- **`DIRECT_URL`**: Use the **direct connection** string (port 5432) — used by Prisma for migrations.

### 3. Push the schema

```bash
npx prisma db push
```

This creates all tables defined in `prisma/schema.prisma`.

---

## Environment Variables Reference

Copy `.env.example` to `.env` and fill in the values below.

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | Yes | Bot OAuth token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Yes | Slack app signing secret |
| `SLACK_APP_TOKEN` | Yes | App-level token (`xapp-...`) |
| `SLACK_USER_TOKEN` | Yes | User OAuth token (`xoxp-...`) |
| `DATABASE_URL` | Yes | Supabase pooled connection URL |
| `DIRECT_URL` | Yes | Supabase direct connection URL |
| `PORT` | No | HTTP port (default: `3000`) |
| `DEFAULT_TIMEZONE` | No | Fallback timezone (default: `America/New_York`) |
| `APP_URL` | Yes | Public base URL of the app (e.g. `https://dd.example.com`) |
| `LOG_LEVEL` | No | Log verbosity: `debug`, `info`, `warn`, `error` (default: `info`) |
| `SENTRY_DSN` | No | Sentry DSN for error tracking (optional) |
| `SCRIPTS_AUTH_USERNAME` | No | Username for `/scripts-docs` route (default: `admin`) |
| `SCRIPTS_AUTH_PASSWORD` | No | Password for `/scripts-docs` route (default: `daily-dose-admin`) |

---

## Prerequisites

### VPS Requirements
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+ installed
- PM2 process manager
- Git
- PostgreSQL or access to Supabase database

### GitHub Secrets Setup

Add these secrets to your GitHub repository (Settings → Secrets and Variables → Actions):

```
VPS_HOST=your-vps-ip-address
VPS_USERNAME=your-vps-username
VPS_SSH_KEY=your-private-ssh-key
VPS_PORT=22
APP_PORT=3000
```

## VPS Initial Setup

### 1. Connect to your VPS
```bash
ssh your-username@your-vps-ip
```

### 2. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Install PM2 globally
```bash
sudo npm install -g pm2
```

### 4. Setup PM2 to start on boot
```bash
pm2 startup
# Follow the instructions displayed
```

### 5. Clone your repository
```bash
cd /home/your-username
git clone https://github.com/your-username/daily-dose.git
cd daily-dose
```

### 6. Install dependencies
```bash
npm ci
```

### 7. Setup environment variables
```bash
nano .env
```

Fill in your environment variables (see [Environment Variables Reference](#environment-variables-reference) above).

### 8. Setup database
```bash
npx prisma generate
npx prisma db push
```

### 9. Create logs directory
```bash
mkdir -p logs
```

### 10. Start the application
```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

## SSH Key Setup

### 1. Generate SSH key pair (on your local machine)
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions@daily-dose"
```

### 2. Copy public key to VPS
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub your-username@your-vps-ip
```

### 3. Add private key to GitHub Secrets
- Copy the content of `~/.ssh/id_rsa` (private key)
- Add it as `VPS_SSH_KEY` secret in GitHub

## Firewall Configuration

Open necessary ports:
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # App port
sudo ufw enable
```

---

## Nginx Reverse Proxy

If you want to serve the bot behind a domain with HTTPS, install Nginx and Certbot:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

Create `/etc/nginx/sites-available/your-domain.conf`:

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it and get a certificate:

```bash
sudo ln -s /etc/nginx/sites-available/your-domain.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

Update your `.env`:

```env
APP_URL=https://your-domain.com
```

Update your Slack app's **Request URL** in Event Subscriptions and Slash Commands to `https://your-domain.com/slack/events`.

---

## Deployment Workflow

The GitHub Action will automatically:
1. Run on pushes to `main` branch
2. Install dependencies and generate Prisma client
3. SSH to your VPS
4. Pull latest changes
5. Install/update dependencies
6. Run database migrations
7. Restart the application with PM2
8. Perform health check

## Manual Deployment Commands

If needed, you can deploy manually:

```bash
# On VPS
cd /home/your-username/daily-dose
git pull origin main
npm ci
npx prisma generate
npx prisma db push
pm2 restart daily-dose
```

## Monitoring

### Check application status
```bash
pm2 status
pm2 logs daily-dose
```

### View health check
```bash
curl http://localhost:3000/health
```

### Monitor logs
```bash
pm2 logs daily-dose --lines 100
```

## Troubleshooting

### Common Issues

1. **Permission denied during deployment**
   - Ensure SSH key is properly added to `~/.ssh/authorized_keys`
   - Check file permissions: `chmod 600 ~/.ssh/authorized_keys`

2. **Port already in use**
   - Check if another process is using port 3000: `sudo lsof -i :3000`
   - Kill the process or change the PORT in environment variables

3. **Database connection errors**
   - Verify DATABASE_URL and DIRECT_URL in .env
   - Ensure database is accessible from VPS

4. **PM2 app not starting**
   - Check logs: `pm2 logs daily-dose`
   - Verify all environment variables are set
   - Ensure Prisma client is generated: `npx prisma generate`

### Health Check Endpoints

- `GET /health` - Returns application health status
- Response: `{"status": "healthy", "timestamp": "...", "service": "daily-dose"}`

## Security Considerations

1. Use environment variables for all sensitive data
2. Keep VPS and dependencies updated
3. Use firewall to restrict access
4. Regularly rotate SSH keys and tokens
5. Monitor logs for unusual activity

## Backup Strategy

1. Database backups (if using local PostgreSQL)
2. Environment configuration backup
3. Application logs retention policy
