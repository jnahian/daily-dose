export function Scripts() {
  return (
    <div className="pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Scripts Documentation
          </h1>
          <p className="text-xl text-gray-600">
            Administrative tools and automation scripts for Daily Dose
          </p>
          <span className="inline-block mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            🔐 Admin Only
          </span>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            ⚠️ Administrator Access Required
          </h3>
          <p className="text-red-800">
            These scripts have direct database access and can modify critical data.
            Only authorized administrators should execute these commands. Always test
            in development before running in production.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🗄️ Database Operations
            </h3>
            <p className="text-gray-600 mb-4">
              Scripts for initializing and managing database records, including
              organization setup and user management.
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Organization seeding</li>
              <li>• Initial admin setup</li>
              <li>• Test team creation</li>
            </ul>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              👥 Team Management
            </h3>
            <p className="text-gray-600 mb-4">
              Tools for analyzing team membership, promotions, and member status
              checking across different dates.
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Member eligibility checking</li>
              <li>• Role promotions</li>
              <li>• Leave status analysis</li>
            </ul>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🤖 Automation Tools
            </h3>
            <p className="text-gray-600 mb-4">
              Scripts for triggering standup processes, manual posting, and
              scheduling operations outside normal automation.
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Manual standup triggers</li>
              <li>• Custom posting times</li>
              <li>• Schedule debugging</li>
            </ul>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ⚙️ Configuration
            </h3>
            <p className="text-gray-600 mb-4">
              Slack app configuration management, manifest updates, and workspace
              information retrieval.
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Slack app manifest management</li>
              <li>• Workspace info extraction</li>
              <li>• API configuration testing</li>
            </ul>
          </div>
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            📋 Available Scripts
          </h2>

          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                seedOrg.js
              </h3>
              <p className="text-gray-600 mb-4">
                Initializes a new organization in the database with default settings,
                creates an initial admin user, and sets up a test team.
              </p>
              <div className="code-block p-4 relative">
                <pre className="font-mono text-sm">
                  <code>{`# Run the seeding script
node scripts/seedOrg.js

# Alternative: Run via npm script
npm run seed`}</code>
                </pre>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                check-team-members.js
              </h3>
              <p className="text-gray-600 mb-4">
                Analyzes team membership and determines which members are eligible for
                standup reminders on a given date.
              </p>
              <div className="code-block p-4 relative">
                <pre className="font-mono text-sm">
                  <code>{`# Check all teams for today
node scripts/check-team-members.js

# Check specific team
node scripts/check-team-members.js "TeamName"

# Check team for specific date
node scripts/check-team-members.js TeamName 2025-01-15`}</code>
                </pre>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                triggerStandup.js
              </h3>
              <p className="text-gray-600 mb-4">
                Manually triggers standup reminders for a specific team outside of the
                normal scheduled time.
              </p>
              <div className="code-block p-4 relative">
                <pre className="font-mono text-sm">
                  <code>{`# Trigger standup for specific team
node scripts/triggerStandup.js "TeamName"

# Alternative: Use npm script
npm run standup:trigger "TeamName"`}</code>
                </pre>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                sendManualStandup.js
              </h3>
              <p className="text-gray-600 mb-4">
                Manually posts standup summaries to team channels for any date and
                time.
              </p>
              <div className="code-block p-4 relative">
                <pre className="font-mono text-sm">
                  <code>{`# Post today's standup for specific team
node scripts/sendManualStandup.js "TeamName"

# Post standup for specific date
node scripts/sendManualStandup.js "TeamName" 2025-01-15

# Alternative: Use npm script
npm run standup:post "TeamName" "2025-01-15"`}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ✅ Prerequisites
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <ul className="space-y-3 text-gray-800">
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span>
                  <strong>Database Access:</strong> Full read/write permissions to
                  PostgreSQL database
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span>
                  <strong>Slack Permissions:</strong> Bot token with necessary scopes
                  for your workspace
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span>
                  <strong>Node.js:</strong> Version 16+ with npm package management
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span>
                  <strong>File System:</strong> Write access to project directory for
                  logs and temp files
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
