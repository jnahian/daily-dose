# Deployment Guide - Hetzner VPS

This guide covers the setup and deployment of the Daily Dose bot to a Hetzner VPS using GitHub Actions.

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
git clone https://github.com/your-username/daily-dose-bot.git
cd daily-dose-bot
```

### 6. Install dependencies
```bash
npm ci
```

### 7. Setup environment variables
```bash
cp .env.example .env
nano .env
```

Fill in your environment variables:
```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_USER_TOKEN=xoxp-your-user-token
DATABASE_URL=your-database-url
DIRECT_URL=your-direct-database-url
PORT=3000
DEFAULT_TIMEZONE=America/New_York
APP_URL=http://your-vps-ip:3000
```

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
ssh-keygen -t rsa -b 4096 -C "github-actions@daily-dose-bot"
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
cd /home/your-username/daily-dose-bot
git pull origin main
npm ci
npx prisma generate
npx prisma db push
pm2 restart daily-dose-bot
```

## Monitoring

### Check application status
```bash
pm2 status
pm2 logs daily-dose-bot
```

### View health check
```bash
curl http://localhost:3000/health
```

### Monitor logs
```bash
pm2 logs daily-dose-bot --lines 100
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
   - Check logs: `pm2 logs daily-dose-bot`
   - Verify all environment variables are set
   - Ensure Prisma client is generated: `npx prisma generate`

### Health Check Endpoints

- `GET /health` - Returns application health status
- Response: `{"status": "healthy", "timestamp": "...", "service": "daily-dose-bot"}`

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