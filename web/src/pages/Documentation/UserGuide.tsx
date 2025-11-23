export function UserGuide() {
  return (
    <div className="pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            User Guide - Documentation
          </h1>
          <p className="text-xl text-gray-600">
            Complete guide for setting up and using Daily Dose
          </p>
        </div>

        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-cyan-900 mb-2">
            📚 What is Daily Dose?
          </h3>
          <p className="text-cyan-800 leading-relaxed">
            Daily Dose is an intelligent Slack bot that streamlines your team's
            standup meetings. It automatically sends reminders, collects responses
            through interactive modals, and posts beautifully formatted summaries to
            your team channels.
          </p>
        </div>

        <div className="prose max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              🚀 Getting Started
            </h2>
            <p className="text-gray-600 mb-4">
              Daily Dose helps automate your team's daily standup meetings in Slack.
              This guide will walk you through installation, setup, and daily usage.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📦 Installation
            </h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-800">
                <strong>Admin Only:</strong> Daily Dose requires custom installation
                by workspace administrators. Contact us for setup assistance.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              💬 Slash Commands
            </h2>
            <div className="bg-white border rounded-lg p-6 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">Team Management</h3>
              <ul className="space-y-2 text-gray-600">
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded">/dd-team-create</code>{' '}
                  - Create a new standup team
                </li>
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded">/dd-team-list</code>{' '}
                  - List all teams
                </li>
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded">/dd-team-info</code>{' '}
                  - View team details
                </li>
              </ul>
            </div>

            <div className="bg-white border rounded-lg p-6 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                Standup Submission
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded">
                    /dd-standup-submit
                  </code>{' '}
                  - Submit your daily standup
                </li>
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded">
                    /dd-standup-update
                  </code>{' '}
                  - Update your standup response
                </li>
              </ul>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Leave Management</h3>
              <ul className="space-y-2 text-gray-600">
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded">/dd-leave-add</code>{' '}
                  - Add leave dates
                </li>
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded">
                    /dd-leave-cancel
                  </code>{' '}
                  - Cancel leave
                </li>
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded">/dd-leave-list</code>{' '}
                  - List your leaves
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              🔧 Configuration
            </h2>
            <p className="text-gray-600 mb-4">
              Daily Dose offers flexible configuration options for teams including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
              <li>Timezone settings for accurate scheduling</li>
              <li>Custom standup and posting times</li>
              <li>Work day configuration (Mon-Fri, custom schedules)</li>
              <li>Holiday management</li>
              <li>Leave tracking</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              ❓ Troubleshooting
            </h2>
            <div className="bg-white border rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                Common Issues and Solutions
              </h3>
              <div className="space-y-4 text-gray-600">
                <div>
                  <p className="font-medium">Not receiving reminders?</p>
                  <p className="text-sm">
                    Check your leave status and work day configuration. Ensure the
                    bot has permission to send you DMs.
                  </p>
                </div>
                <div>
                  <p className="font-medium">Bot not posting to channel?</p>
                  <p className="text-sm">
                    Verify the bot has been invited to the team channel and has
                    posting permissions.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
