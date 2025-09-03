# Slack App Manifest Management

This project includes a script to manage your Slack app manifest via the Slack API.

## Setup

1. **Get a Slack User Token**
   - Go to [Slack API Apps](https://api.slack.com/apps)
   - Select your app or create a new one
   - Go to "OAuth & Permissions"
   - Add the `apps:write` scope to User Token Scopes
   - Install/reinstall the app to get the user token
   - Add the token to your `.env` file as `SLACK_USER_TOKEN`

2. **Update your .env file**
   ```bash
   # Add this line to your .env file
   SLACK_USER_TOKEN=xoxp-your-user-token-here
   ```

## Usage

### Create a New App
```bash
# Using npm script
npm run manifest:create

# Or directly
node src/scripts/updateSlackManifest.js --create
```

### Update Existing App
```bash
# Using npm script (you'll need to provide app ID)
npm run manifest:update -- --app-id A1234567890

# Or directly
node src/scripts/updateSlackManifest.js --app-id A1234567890
```

### Dry Run (Preview Changes)
```bash
# See what would change without applying
npm run manifest:dry-run -- --app-id A1234567890

# Or for new app creation
node src/scripts/updateSlackManifest.js --create --dry-run
```

## Finding Your App ID

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Select your app
3. The App ID is shown in the "Basic Information" section

## Important Notes

- **Update URLs**: Before deploying, replace `https://your-domain.com` in the manifest with your actual domain
- **Permissions**: If you update OAuth scopes, you'll need to reinstall the app
- **User Token**: The script requires a user token with `apps:write` scope, not just a bot token

## Troubleshooting

- **"SLACK_USER_TOKEN not found"**: Make sure you've added the user token to your .env file
- **"apps:write scope required"**: Add the apps:write scope to your user token scopes and reinstall
- **"Manifest contains placeholder URLs"**: Update the URLs in slack-app-manifest.json to your actual domain

## Example Workflow

1. Edit `slack-app-manifest.json` with your changes
2. Run `npm run manifest:dry-run -- --app-id YOUR_APP_ID` to preview
3. Run `npm run manifest:update -- --app-id YOUR_APP_ID` to apply changes
4. Reinstall the app if permissions changed