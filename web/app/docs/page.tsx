import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation - Daily Dose",
  description: "Complete documentation for Daily Dose Slack bot - Commands, setup guide, and troubleshooting",
};

export default function DocsPage() {
  return (
    <div className="max-w-none">
      {/* Getting Started */}
      <section id="getting-started" className="mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Documentation
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Everything you need to know about Daily Dose - the automated standup bot for Slack.
        </p>

        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-l-4 border-primary p-6 rounded-r-lg mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">What is Daily Dose?</h3>
          <p className="text-gray-700">
            Daily Dose is an intelligent Slack bot that streamlines your team&apos;s standup meetings.
            It automatically sends reminders, collects responses through interactive modals, and posts
            beautifully formatted summaries to your team channels.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600 mb-1">30+</div>
            <div className="text-sm text-green-800">Minutes saved daily</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600 mb-1">85%</div>
            <div className="text-sm text-blue-800">Team engagement boost</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600 mb-1">∞</div>
            <div className="text-sm text-purple-800">Timezone support</div>
          </div>
        </div>
      </section>

      {/* Installation */}
      <section id="installation" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Installation</h2>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-semibold text-yellow-800">Admin Only</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Daily Dose requires custom installation by workspace administrators. Contact us for setup assistance.
              </p>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-4">Prerequisites</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6 ml-0">
          <li>Slack workspace admin permissions</li>
          <li>Ability to install custom Slack apps</li>
          <li>Channel permissions for bot posting</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-4">Installation Process</h3>
        <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-6 ml-0">
          <li><strong>Contact for Installation</strong> - Reach out to our team for custom installation in your workspace</li>
          <li><strong>App Configuration</strong> - We&apos;ll configure the bot with proper permissions and webhook endpoints</li>
          <li><strong>Team Onboarding</strong> - Start creating teams and enjoy automated standup management!</li>
        </ol>
      </section>

      {/* Quick Start */}
      <section id="quick-start" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Quick Start</h2>

        <div className="space-y-6">
          <div className="border-l-4 border-primary pl-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Join Your Organization</h3>
            <p className="text-gray-600">
              When you first interact with the bot, you&apos;ll be automatically added to your organization
              based on your Slack workspace. No manual signup required!
            </p>
          </div>

          <div className="border-l-4 border-primary pl-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Explore Available Teams</h3>
            <p className="text-gray-600 mb-3">
              Use the team list command to see available teams:
            </p>
            <div className="bg-gray-900 rounded-lg p-4">
              <code className="text-green-400">/dd-team-list</code>
            </div>
          </div>

          <div className="border-l-4 border-primary pl-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Join or Create a Team</h3>
            <p className="text-gray-600 mb-3">Join an existing team or create a new one:</p>
            <div className="space-y-2">
              <div className="bg-gray-900 rounded-lg p-4">
                <code className="text-green-400">/dd-team-join Engineering</code>
                <p className="text-gray-400 text-sm mt-1">Join a specific team</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <code className="text-green-400">/dd-team-create Engineering 09:30 10:00</code>
                <p className="text-gray-400 text-sm mt-1">Create a new team (admin only)</p>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-primary pl-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">4. Submit Your First Standup</h3>
            <p className="text-gray-600 mb-3">
              The bot will send you DM reminders, or you can submit manually:
            </p>
            <div className="bg-gray-900 rounded-lg p-4">
              <code className="text-green-400">/dd-standup</code>
              <p className="text-gray-400 text-sm mt-1">Submit standup for team in current channel</p>
            </div>
          </div>
        </div>
      </section>

      {/* Standup Format */}
      <section id="configuration" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Standup Format</h2>
        <p className="text-gray-600 mb-6">
          Each standup submission includes three sections:
        </p>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start">
              <span className="text-2xl mr-4">📄</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Last Working Day&apos;s Tasks</h3>
                <p className="text-gray-600">What you worked on your last working day - completed work and outcomes</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start">
              <span className="text-2xl mr-4">🎯</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Today&apos;s Tasks</h3>
                <p className="text-gray-600">What you plan to work on today - specific goals and tasks</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start">
              <span className="text-2xl mr-4">⚠️</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Blockers</h3>
                <p className="text-gray-600">Any obstacles or help needed - optional but important</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commands Section */}
      <section id="commands" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Commands Reference</h2>

        {/* Standup Commands */}
        <div id="standup-commands" className="mb-12 scroll-mt-20">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">Standup Commands</h3>

          <div className="space-y-8">
            {/* Manual Standup Submission */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-standup [team-name]</code>
              </div>
              <p className="text-gray-600 mb-4">
                Submit a standup outside of scheduled reminder times. Team name is optional when run in a team channel.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Examples:</p>
                <code className="block text-sm text-gray-800">/dd-standup</code>
                <p className="text-xs text-gray-600">Use team in current channel</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-standup Engineering</code>
                <p className="text-xs text-gray-600">Submit for specific team</p>
              </div>
            </div>

            {/* Update Standup */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-standup-update [team-name] [YYYY-MM-DD]</code>
              </div>
              <p className="text-gray-600 mb-4">
                Update your standup for today or any specific date. Team name is optional when run in a team channel.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Examples:</p>
                <code className="block text-sm text-gray-800">/dd-standup-update</code>
                <p className="text-xs text-gray-600">Update today for current channel team</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-standup-update 2024-01-15</code>
                <p className="text-xs text-gray-600">Update specific date for current channel team</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-standup-update Engineering 2024-01-15</code>
                <p className="text-xs text-gray-600">Update specific date for specific team</p>
              </div>
              <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Pre-filled with existing data if available. Updates after posting time appear as thread replies.
                </p>
              </div>
            </div>

            {/* Reminder Preferences */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-standup-reminder [team-name] [parameters]</code>
              </div>
              <p className="text-gray-600 mb-4">
                Control your standup reminder preferences with granular control over notifications and visibility.
              </p>
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Parameters:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-0">
                  <li><strong>mention=on/off</strong> - Controls whether you appear in &quot;Not Responded&quot; list</li>
                  <li><strong>notify=on/off</strong> - Controls whether you receive daily reminder DMs</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Examples:</p>
                <code className="block text-sm text-gray-800">/dd-standup-reminder</code>
                <p className="text-xs text-gray-600">Check current settings</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-standup-reminder mention=off</code>
                <p className="text-xs text-gray-600">Hide from non-responded list</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-standup-reminder notify=off mention=off</code>
                <p className="text-xs text-gray-600">Disable both notifications and mentions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Commands */}
        <div id="team-commands" className="mb-12 scroll-mt-20">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">Team Management Commands</h3>

          <div className="space-y-8">
            {/* View Teams */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-team-list</code>
              </div>
              <p className="text-gray-600 mb-4">
                List all teams in your organization with detailed information including member count,
                reminder time, posting time, and timezone.
              </p>
            </div>

            {/* Team Members */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-team-members [team-name]</code>
              </div>
              <p className="text-gray-600 mb-4">
                View all members of a team. Team name is optional when run in a team channel.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Examples:</p>
                <code className="block text-sm text-gray-800">/dd-team-members</code>
                <p className="text-xs text-gray-600">Show members of team in current channel</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-team-members Engineering</code>
                <p className="text-xs text-gray-600">Show members of specific team</p>
              </div>
            </div>

            {/* Join Team */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-team-join [team-name]</code>
              </div>
              <p className="text-gray-600 mb-4">
                Join an existing team. Team name is optional when run in a team channel.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Examples:</p>
                <code className="block text-sm text-gray-800">/dd-team-join</code>
                <p className="text-xs text-gray-600">Join team in current channel</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-team-join Engineering</code>
                <p className="text-xs text-gray-600">Join specific team</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-team-join &quot;Product Team&quot;</code>
                <p className="text-xs text-gray-600">Join team with spaces in name</p>
              </div>
            </div>

            {/* Leave Team */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-team-leave [team-name]</code>
              </div>
              <p className="text-gray-600 mb-4">
                Leave a team. Team name is optional when run in a team channel.
              </p>
            </div>

            {/* Create Team - Admin Only */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white bg-gradient-to-r from-yellow-50">
              <div className="flex items-center mb-4">
                <code className="text-lg font-mono text-primary mr-3">/dd-team-create [name] &lt;standup-time&gt; &lt;posting-time&gt;</code>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">ADMIN</span>
              </div>
              <p className="text-gray-600 mb-4">
                Create a new team. Team name is optional - uses channel name if not provided. Times in 24-hour format (HH:MM).
              </p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Examples:</p>
                <code className="block text-sm text-gray-800">/dd-team-create 09:30 10:00</code>
                <p className="text-xs text-gray-600">Uses channel name</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-team-create Engineering 09:30 10:00</code>
                <p className="text-xs text-gray-600">Custom team name</p>
              </div>
            </div>

            {/* Update Team - Admin Only */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white bg-gradient-to-r from-yellow-50">
              <div className="flex items-center mb-4">
                <code className="text-lg font-mono text-primary mr-3">/dd-team-update [team-name] [parameters]</code>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">ADMIN</span>
              </div>
              <p className="text-gray-600 mb-4">
                Update team settings. Team name is optional when run in a team channel.
              </p>
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Available Parameters:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-0">
                  <li><strong>name=NewName</strong> - Change team name</li>
                  <li><strong>standup=HH:MM</strong> - Change reminder time</li>
                  <li><strong>posting=HH:MM</strong> - Change posting time</li>
                  <li><strong>notifications=true/false</strong> - Admin notifications</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Examples:</p>
                <code className="block text-sm text-gray-800">/dd-team-update standup=09:00</code>
                <p className="text-xs text-gray-600">Update team in current channel</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-team-update Engineering standup=09:00 posting=10:30</code>
                <p className="text-xs text-gray-600">Update specific team with multiple parameters</p>
              </div>
            </div>
          </div>
        </div>

        {/* Leave Commands */}
        <div id="leave-commands" className="mb-12 scroll-mt-20">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">Leave Management Commands</h3>

          <div className="space-y-8">
            {/* View Leaves */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-leave-list</code>
              </div>
              <p className="text-gray-600">
                Check your upcoming and current leave dates.
              </p>
            </div>

            {/* Set Leave */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-leave-set &lt;date&gt; [reason]</code>
              </div>
              <p className="text-gray-600 mb-4">
                Set vacation and leave dates to skip standup reminders.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Examples:</p>
                <code className="block text-sm text-gray-800">/dd-leave-set 2024-12-25 Holiday</code>
                <p className="text-xs text-gray-600">Single day leave</p>
                <code className="block text-sm text-gray-800 mt-2">/dd-leave-set 2024-12-23 2024-12-27 Holiday break</code>
                <p className="text-xs text-gray-600">Date range leave</p>
              </div>
              <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-3">
                <p className="text-sm text-blue-800">
                  When on leave: No standup reminders sent, marked as &quot;On leave&quot; in summaries, automatically excluded from expectations.
                </p>
              </div>
            </div>

            {/* Cancel Leave */}
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <code className="text-lg font-mono text-primary">/dd-leave-cancel &lt;leave-id&gt;</code>
              </div>
              <p className="text-gray-600">
                Cancel previously set leave dates. Get the leave ID from <code className="text-sm bg-gray-100 px-1 rounded">/dd-leave-list</code> command.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Features</h2>

        <div className="space-y-8">
          <div id="automated-reminders" className="scroll-mt-20">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Automated Reminders</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-3">How Reminders Work</h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-0">
                <li>Bot sends DM at your team&apos;s configured standup time</li>
                <li>Smart filtering skips users on leave or non-work days</li>
                <li>Interactive modal provides easy-to-use form</li>
                <li>One-click submission with interactive buttons</li>
              </ol>
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Features:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-0">
                  <li>Timezone-aware scheduling</li>
                  <li>Work day filtering (respects personal schedules)</li>
                  <li>Holiday exclusion (organization-wide holidays)</li>
                  <li>Leave period exclusion (personal time off)</li>
                </ul>
              </div>
            </div>
          </div>

          <div id="multi-team-support" className="scroll-mt-20">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Multi-Team Support</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 mb-4">
                Daily Dose automatically handles teams spanning multiple timezones. You can be on multiple teams
                and will receive reminders for each team at their configured times.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-0">
                <li>Each team has a configured timezone</li>
                <li>Supports all standard timezone identifiers</li>
                <li>Automatic daylight saving adjustment</li>
                <li>Cross-timezone coordination</li>
              </ul>
            </div>
          </div>

          <div id="leave-management" className="scroll-mt-20">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Leave Management</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600">
                Track team member leave to avoid sending unnecessary reminders. When someone is on leave,
                they won&apos;t receive standup reminders and won&apos;t be included in the &quot;Not Responded&quot; list.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section id="best-practices" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Best Practices</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
              <span className="mr-2">✅</span> Do&apos;s
            </h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li>• Choose consistent daily times</li>
              <li>• Allow 30+ minutes between reminder and posting</li>
              <li>• Use dedicated team channels</li>
              <li>• Set clear team expectations</li>
              <li>• Configure work days for part-time members</li>
              <li>• Set up organizational holidays</li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
              <span className="mr-2">❌</span> Don&apos;ts
            </h3>
            <ul className="space-y-2 text-sm text-red-800">
              <li>• Don&apos;t use shared channels for multiple teams</li>
              <li>• Don&apos;t set reminder and posting too close together</li>
              <li>• Don&apos;t forget to communicate process to new members</li>
              <li>• Don&apos;t ignore timezone differences</li>
              <li>• Don&apos;t forget to set leave dates</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section id="troubleshooting" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Troubleshooting</h2>

        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Not receiving reminders?</h3>
            <p className="text-gray-600 mb-3">Check the following:</p>
            <div className="space-y-2">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-sm font-semibold text-gray-700 mb-1">Check team membership:</p>
                <code className="text-sm text-primary">/dd-team-list</code>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-sm font-semibold text-gray-700 mb-1">Verify work days:</p>
                <code className="text-sm text-primary">/dd-workdays-show</code>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-sm font-semibold text-gray-700 mb-1">Check leave status:</p>
                <code className="text-sm text-primary">/dd-leave-list</code>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Can&apos;t create a team?</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 ml-0">
              <li>You need admin permissions in your organization</li>
              <li>Contact your organization admin for access</li>
              <li>Ensure you&apos;re in the correct Slack channel</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Standup not posting to channel?</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 ml-0">
              <li>Ensure the bot has permissions to post in the channel</li>
              <li>Check if the team was created in the correct channel</li>
              <li>Verify the posting time hasn&apos;t passed</li>
              <li>Contact admin if permissions need adjustment</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Wrong timezone?</h3>
            <p className="text-gray-600">
              Team timezones are set during team creation. Contact your team admin to update timezone settings.
              Times are displayed in the team&apos;s configured timezone.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="advanced" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h2>

        <div className="space-y-4">
          <details className="border border-gray-200 rounded-lg p-6 bg-white">
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
              Can I be on multiple teams?
            </summary>
            <p className="text-gray-600 mt-3">
              Yes! You can join multiple teams and will receive reminders for each team at their configured times.
              Each team operates independently with its own schedule and channel.
            </p>
          </details>

          <details className="border border-gray-200 rounded-lg p-6 bg-white">
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
              What happens if I miss the reminder?
            </summary>
            <p className="text-gray-600 mt-3">
              You can submit a standup anytime using <code className="text-sm bg-gray-100 px-1 rounded">/dd-standup</code>.
              If you submit after the posting time, your response will be added as a thread reply to the team&apos;s summary.
            </p>
          </details>

          <details className="border border-gray-200 rounded-lg p-6 bg-white">
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
              Can I edit my standup after submitting?
            </summary>
            <p className="text-gray-600 mt-3">
              Yes! Use <code className="text-sm bg-gray-100 px-1 rounded">/dd-standup-update</code> to edit today&apos;s standup.
              Add a specific date to edit historical standups. Updates after posting time will appear as thread replies.
            </p>
          </details>

          <details className="border border-gray-200 rounded-lg p-6 bg-white">
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
              How do I set up for part-time team members?
            </summary>
            <p className="text-gray-600 mt-3">
              Part-time members can configure their work days using <code className="text-sm bg-gray-100 px-1 rounded">/dd-workdays-set</code>
              with their specific working days. They&apos;ll only receive reminders on their configured work days.
            </p>
          </details>

          <details className="border border-gray-200 rounded-lg p-6 bg-white">
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
              What about weekends and holidays?
            </summary>
            <p className="text-gray-600 mt-3">
              The bot respects both personal work days and organization-wide holidays. Admins can set holidays,
              and individual users configure work days. No reminders are sent on non-work days or holidays.
            </p>
          </details>
        </div>
      </section>

      {/* Support */}
      <section id="support" className="mb-16 scroll-mt-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Support & Contact</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📧 Email Support</h3>
            <p className="text-gray-600 mb-3">Get help with setup, configuration, or issues</p>
            <a
              href="mailto:support@dailydose.bot"
              className="text-primary hover:underline font-medium"
            >
              support@dailydose.bot
            </a>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">💻 GitHub</h3>
            <p className="text-gray-600 mb-3">View source code and report issues</p>
            <a
              href="https://github.com/yourusername/daily-dose-bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t border-gray-200 pt-8 mt-12">
        <p className="text-gray-500 text-center">
          Have questions? Check out our{" "}
          <a href="https://github.com/yourusername/daily-dose-bot" className="text-primary hover:underline">
            GitHub repository
          </a>{" "}
          or{" "}
          <a href="mailto:support@dailydose.bot" className="text-primary hover:underline">
            contact support
          </a>.
        </p>
      </div>
    </div>
  );
}
