# Slack App Manifest Management

This project includes a script to manage your Slack app manifest via the Slack API.

## Setup

1. **Get an app configuration token**
   - Go to [Slack API Apps](https://api.slack.com/apps)
   - Under "Your App Configuration Tokens", generate a token for your workspace
   - Copy both the access token (`xoxe.xoxp-…`, valid 12 hours) and the refresh token (`xoxe-…`)

2. **Update your .env file**
   ```bash
   SLACK_USER_TOKEN=xoxe.xoxp-...
   SLACK_USER_REFRESH_TOKEN=xoxe-...
   SLACK_APP_ID=A...
   ```
   The script rotates the pair itself when the access token has expired and writes the new values back to `.env`. Each machine that runs the script needs its own pair: rotating on one machine invalidates the refresh token everywhere else it was copied.

## Usage

### Create a New App

```bash
# Using npm script
npm run manifest:create

# Or directly
node scripts/updateSlackManifest.js --create
```

### Update Existing App

```bash
# The app ID is read from SLACK_APP_ID in .env
npm run manifest:update

# Or directly
node scripts/updateSlackManifest.js
```

### Validate Only

```bash
# Ask Slack to check the manifest against its schema, then stop
npm run manifest:validate
```

Every update or create runs this check first and aborts on the first failing manifest, printing each problem as `pointer: message`. Pass `--validate` alone to check without applying.

### Export (What Slack Has Now)

```bash
npm run manifest:export
```

Prints the manifest Slack currently holds for `SLACK_APP_ID`. Use it after an update to confirm the change landed.

### Dry Run (Preview Changes)

```bash
# Print the resolved manifest without calling Slack at all
npm run manifest:dry-run

# Or for new app creation
node scripts/updateSlackManifest.js --create --dry-run
```

## Finding Your App ID

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Select your app
3. The App ID is shown in the "Basic Information" section; put it in `.env` as `SLACK_APP_ID`

## Important Notes

- **Update URLs**: Before deploying, replace `https://your-domain.com` in the manifest with your actual domain
- **Permissions**: If you update OAuth scopes, you'll need to reinstall the app
- **Token**: The script needs an app configuration token and its refresh token, not a bot or user OAuth token

## Troubleshooting

- **"SLACK_USER_TOKEN not found"**: Make sure you've added the user token to your .env file
- **`invalid_auth` on every call, no rotation attempted**: `SLACK_USER_REFRESH_TOKEN` is missing, so the expired access token can't be renewed
- **"Manifest contains placeholder URLs"**: Update the URLs in slack-app-manifest.json to your actual domain
- **"Manifest rejected by Slack (N problems)"**: The lines above it list each failing field as a JSON pointer into the manifest, e.g. `/oauth_config/redirect_urls/1: invalid url`. Fix those and re-run.
- **`invalid_auth` then "Token refresh failed: internal_error"**: The refresh token in your `.env` has already been rotated somewhere else (the production deploy rotates and keeps its own). Generate a fresh app configuration token at https://api.slack.com/apps → "Your App Configuration Tokens" and put both values in `.env`.

## Example Workflow

1. Edit `slack-app-manifest.json` with your changes
2. Run `npm run manifest:validate` so Slack checks it
3. Run `npm run manifest:dry-run` to preview the resolved manifest
4. Run `npm run manifest:update` to apply changes
5. Run `npm run manifest:export` and check the changed section came back as sent
6. Reinstall the app if permissions changed
