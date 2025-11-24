import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHistory, faBook } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'

export function Changelog() {
  const versions = [
    {
      version: '1.3.0',
      date: '2025-11-09',
      type: 'latest',
      changes: {
        added: [
          'Manual standup trigger commands for admins and organization owners',
          '/dd-standup-remind [team-name] - Send standup reminders',
          '/dd-standup-post [YYYY-MM-DD] [team-name] - Post standup summary',
          '/dd-standup-preview [YYYY-MM-DD] [team-name] - Preview standup summary',
          '/dd-standup-followup [team-name] - Send followup reminders',
          'Permission system with role-based access control',
          'Context-aware team resolution in commands',
          'Block helper functions for formatted command responses',
          'Comprehensive audit logging for all admin actions',
        ],
      },
    },
    {
      version: '1.2.0',
      date: '2025-11-09',
      type: 'previous',
      changes: {
        changed: [
          'Late standup submissions now create full standup posts when no parent message exists',
          'First late submission for the day creates a complete standup post with all sections',
          'Subsequent late submissions are added as threaded replies to the parent',
        ],
      },
    },
    {
      version: '1.1.0',
      date: '2025-11-02',
      type: 'previous',
      changes: {
        added: [
          'Admin leave management commands for team admins',
          '/dd-leave-set-member - Set leave for any team member (admin only)',
          '/dd-leave-cancel-member - Cancel team member\'s leave (admin only)',
          '/dd-leave-list-member - List team member\'s upcoming leaves (admin only)',
          'Support for @mentions in admin leave commands',
          'Smart team detection for single-team admins',
          'Slack app manifest auto-update during deployment',
        ],
        changed: [
          'Leave management section in README reorganized',
          'Slack manifest updated with new admin leave commands',
        ],
      },
    },
    {
      version: '1.0.2',
      date: '2025-11-02',
      type: 'previous',
      changes: {
        added: [
          'Git-based package versioning with SemVer policy',
          'Automated deployment on version tag push',
          'Version management scripts (patch, minor, major)',
          'GitHub Actions workflow for version releases',
          'Changelog page with version history',
        ],
        changed: [
          'Standup posting logic to skip when no eligible members exist',
          'Standup messages exclude mention=off members from display',
        ],
      },
    },
    {
      version: '1.0.0',
      date: '2025-11-02',
      type: 'initial',
      changes: {
        added: [
          'Initial release of Daily Dose Slack bot',
          'Automated daily standup reminders',
          'Team management commands',
          'Leave tracking system',
          'Timezone-aware scheduling',
          'Work day configuration',
          'Standup response collection via modals',
          'Team standup summaries',
          'Late submission threading',
          'User preference management',
          'Admin role management',
          'Multi-tenant organization support',
        ],
      },
    },
  ]

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'added':
        return 'bg-green-100 text-green-800'
      case 'changed':
        return 'bg-blue-100 text-blue-800'
      case 'fixed':
        return 'bg-yellow-100 text-yellow-800'
      case 'removed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getVersionBadge = (type: string) => {
    if (type === 'latest') {
      return 'bg-green-100 text-green-800 border-2 border-green-300'
    }
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <>
      {/* Hero Section */}
      <section className="py-16 bg-linear-to-r from-primary to-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            <FontAwesomeIcon icon={faHistory} className="mr-3" />
            Changelog
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto mb-8">
            Track all updates, new features, and improvements to Daily Dose. We
            follow{' '}
            <a
              href="https://semver.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Semantic Versioning
            </a>{' '}
            and keep detailed release notes.
          </p>
          <div className="flex justify-center items-center space-x-4">
            <a
              href="https://github.com/jnahian/daily-dose/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-100 transition-colors gap-2"
            >
              <FontAwesomeIcon icon={faGithub} />
              View on GitHub
            </a>
            <a
              href="/documentation/user-guide"
              className="inline-flex items-center px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors gap-2"
            >
              <FontAwesomeIcon icon={faBook} />
              Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Changelog Versions */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {versions.map((version) => (
            <div
              key={version.version}
              className={`bg-white rounded-xl shadow-lg p-8 mb-8 ${
                version.type === 'latest'
                  ? 'border-2 border-primary shadow-[0_0_20px_rgba(0,207,255,0.3)]'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div
                    className={`${
                      version.type === 'latest'
                        ? 'bg-linear-to-r from-primary to-secondary'
                        : 'bg-gray-800'
                    } text-white px-4 py-2 rounded-lg font-bold text-xl`}
                  >
                    v{version.version}
                  </div>
                  <span className="text-gray-500 text-sm">{version.date}</span>
                </div>
                <span
                  className={`${getVersionBadge(
                    version.type
                  )} px-3 py-1 rounded-full text-sm font-semibold`}
                >
                  {version.type === 'latest'
                    ? 'Latest Release'
                    : version.type === 'initial'
                    ? 'Initial Release'
                    : 'Previous Release'}
                </span>
              </div>

              <div className="space-y-6">
                {version.changes.added && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      <span
                        className={`${getBadgeColor(
                          'added'
                        )} px-3 py-1 rounded-full text-sm mr-2`}
                      >
                        ADDED
                      </span>
                    </h3>
                    <ul className="space-y-2 ml-4">
                      {version.changes.added.map((item, i) => (
                        <li key={i} className="text-gray-700 flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {version.changes.changed && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      <span
                        className={`${getBadgeColor(
                          'changed'
                        )} px-3 py-1 rounded-full text-sm mr-2`}
                      >
                        CHANGED
                      </span>
                    </h3>
                    <ul className="space-y-2 ml-4">
                      {version.changes.changed.map((item, i) => (
                        <li key={i} className="text-gray-700 flex items-start">
                          <span className="text-blue-600 mr-2">→</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Legend Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            📌 Change Categories
          </h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { type: 'added', label: 'Added', description: 'New features' },
              {
                type: 'changed',
                label: 'Changed',
                description: 'Changes in functionality',
              },
              {
                type: 'deprecated',
                label: 'Deprecated',
                description: 'Soon-to-be removed',
              },
              {
                type: 'removed',
                label: 'Removed',
                description: 'Removed features',
              },
              { type: 'fixed', label: 'Fixed', description: 'Bug fixes' },
              {
                type: 'security',
                label: 'Security',
                description: 'Security patches',
              },
            ].map((category) => (
              <div key={category.type} className="bg-white rounded-lg p-4 text-center shadow">
                <span
                  className={`${getBadgeColor(
                    category.type
                  )} px-3 py-1 rounded-full text-sm font-semibold`}
                >
                  {category.label.toUpperCase()}
                </span>
                <p className="text-sm text-gray-600 mt-2">{category.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
