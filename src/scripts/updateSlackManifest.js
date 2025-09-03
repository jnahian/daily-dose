#!/usr/bin/env node

/**
 * Slack App Manifest Management Script
 * 
 * This script allows you to create or update your Slack app manifest via the API.
 * It reads the local manifest file and applies it to your Slack app.
 * 
 * Usage:
 *   node src/scripts/updateSlackManifest.js [options]
 * 
 * Options:
 *   --app-id <id>     Slack app ID (required for updates)
 *   --create          Create a new app instead of updating
 *   --dry-run         Show what would be done without making changes
 *   --help            Show this help message
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

class SlackManifestManager {
    constructor() {
        this.manifestPath = path.join(process.cwd(), 'slack-app-manifest.json');
        this.baseUrl = 'https://slack.com/api';
        
        // Get token from environment
        this.token = process.env.SLACK_USER_TOKEN || process.env.SLACK_BOT_TOKEN;
        
        if (!this.token) {
            console.error('❌ Error: SLACK_USER_TOKEN or SLACK_BOT_TOKEN not found in environment variables');
            console.error('   You need a user token with apps:write scope to manage app manifests');
            process.exit(1);
        }
    }

    /**
     * Load the manifest from the local file
     */
    loadManifest() {
        try {
            const manifestContent = fs.readFileSync(this.manifestPath, 'utf8');
            return JSON.parse(manifestContent);
        } catch (error) {
            console.error(`❌ Error loading manifest from ${this.manifestPath}:`, error.message);
            process.exit(1);
        }
    }

    /**
     * Make API request to Slack
     */
    async makeRequest(endpoint, method = 'POST', body = null) {
        const url = `${this.baseUrl}/${endpoint}`;
        
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            if (!data.ok) {
                throw new Error(`Slack API error: ${data.error} - ${data.detail || ''}`);
            }
            
            return data;
        } catch (error) {
            console.error(`❌ API request failed:`, error.message);
            throw error;
        }
    }

    /**
     * Create a new Slack app from manifest
     */
    async createApp(manifest, dryRun = false) {
        console.log('🚀 Creating new Slack app from manifest...');
        
        if (dryRun) {
            console.log('📋 DRY RUN: Would create app with manifest:');
            console.log(JSON.stringify(manifest, null, 2));
            return;
        }

        try {
            const result = await this.makeRequest('apps.manifest.create', 'POST', {
                manifest: manifest
            });

            console.log('✅ App created successfully!');
            console.log(`   App ID: ${result.app_id}`);
            console.log(`   App Name: ${manifest.display_information.name}`);
            console.log('');
            console.log('📝 Next steps:');
            console.log('   1. Install the app to your workspace');
            console.log('   2. Update your .env file with the new tokens');
            console.log('   3. Update your manifest URLs to point to your actual domain');
            
            return result;
        } catch (error) {
            console.error('❌ Failed to create app:', error.message);
            throw error;
        }
    }

    /**
     * Update existing Slack app manifest
     */
    async updateApp(appId, manifest, dryRun = false) {
        console.log(`🔄 Updating Slack app ${appId} with new manifest...`);
        
        if (dryRun) {
            console.log('📋 DRY RUN: Would update app with manifest:');
            console.log(JSON.stringify(manifest, null, 2));
            return;
        }

        try {
            const result = await this.makeRequest('apps.manifest.update', 'POST', {
                app_id: appId,
                manifest: manifest
            });

            console.log('✅ App manifest updated successfully!');
            console.log(`   App ID: ${appId}`);
            console.log(`   App Name: ${manifest.display_information.name}`);
            
            if (result.permissions_updated) {
                console.log('⚠️  Permissions were updated - you may need to reinstall the app');
            }
            
            return result;
        } catch (error) {
            console.error('❌ Failed to update app:', error.message);
            throw error;
        }
    }

    /**
     * Get current app manifest for comparison
     */
    async getCurrentManifest(appId) {
        try {
            const result = await this.makeRequest('apps.manifest.export', 'GET');
            return result.manifest;
        } catch (error) {
            console.warn('⚠️  Could not fetch current manifest for comparison:', error.message);
            return null;
        }
    }

    /**
     * Validate manifest before applying
     */
    validateManifest(manifest) {
        const required = ['display_information', 'features', 'oauth_config', 'settings'];
        const missing = required.filter(field => !manifest[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required manifest fields: ${missing.join(', ')}`);
        }

        // Check for placeholder URLs
        const manifestStr = JSON.stringify(manifest);
        if (manifestStr.includes('your-domain.com')) {
            console.warn('⚠️  Warning: Manifest contains placeholder URLs (your-domain.com)');
            console.warn('   Make sure to update these with your actual domain before deploying');
        }

        return true;
    }

    /**
     * Main execution method
     */
    async run(options = {}) {
        try {
            const manifest = this.loadManifest();
            this.validateManifest(manifest);

            if (options.create) {
                await this.createApp(manifest, options.dryRun);
            } else {
                if (!options.appId) {
                    console.error('❌ Error: --app-id is required for updates');
                    console.error('   Use --create to create a new app instead');
                    process.exit(1);
                }
                await this.updateApp(options.appId, manifest, options.dryRun);
            }
        } catch (error) {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        }
    }
}

// CLI handling
function showHelp() {
    console.log(`
Slack App Manifest Management Script

Usage:
  node src/scripts/updateSlackManifest.js [options]

Options:
  --app-id <id>     Slack app ID (required for updates)
  --create          Create a new app instead of updating existing one
  --dry-run         Show what would be done without making changes
  --help            Show this help message

Examples:
  # Create a new app
  node src/scripts/updateSlackManifest.js --create

  # Update existing app
  node src/scripts/updateSlackManifest.js --app-id A1234567890

  # Dry run to see changes
  node src/scripts/updateSlackManifest.js --app-id A1234567890 --dry-run

Environment Variables:
  SLACK_USER_TOKEN  User token with apps:write scope (preferred)
  SLACK_BOT_TOKEN   Bot token (fallback, may have limited permissions)
`);
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    console.log('📋 Parsed arguments:', args);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
            case '--app-id':
                options.appId = args[++i];
                break;
            case '--create':
                options.create = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            default:
                console.error(`❌ Unknown option: ${args[i]}`);
                showHelp();
                process.exit(1);
        }
    }

    return options;
}

// Run the script if called directly
if (require.main === module) {
    const options = parseArgs();
    console.log('🚀 Slack App Manifest Management Script 🚀', options);
    const manager = new SlackManifestManager();
    manager.run(options);
}

module.exports = SlackManifestManager;