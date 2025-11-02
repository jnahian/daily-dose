import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog - Daily Dose",
  description: "Latest updates and release notes for Daily Dose",
};

interface Release {
  version: string;
  date: string;
  changes: {
    type: "feature" | "improvement" | "fix";
    description: string;
  }[];
}

const releases: Release[] = [
  {
    version: "1.0.0",
    date: "2025-01-15",
    changes: [
      {
        type: "feature",
        description: "Initial release of Daily Dose bot",
      },
      {
        type: "feature",
        description: "Automated standup reminders via DM",
      },
      {
        type: "feature",
        description: "Multi-team support with separate configurations",
      },
      {
        type: "feature",
        description: "Leave management system",
      },
      {
        type: "feature",
        description: "Flexible scheduling per team",
      },
    ],
  },
];

const typeColors = {
  feature: "bg-green-100 text-green-800 border-green-200",
  improvement: "bg-blue-100 text-blue-800 border-blue-200",
  fix: "bg-red-100 text-red-800 border-red-200",
};

const typeLabels = {
  feature: "✨ Feature",
  improvement: "⚡ Improvement",
  fix: "🐛 Fix",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen pt-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Changelog</h1>
        <p className="text-xl text-gray-600 mb-12">
          Track all updates, improvements, and bug fixes
        </p>

        <div className="space-y-12">
          {releases.map((release) => (
            <div
              key={release.version}
              className="bg-white rounded-xl shadow-sm p-8 border border-gray-200"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Version {release.version}
                  </h2>
                  <p className="text-gray-500 mt-1">
                    Released on {new Date(release.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold">
                  Latest
                </span>
              </div>

              <div className="space-y-3">
                {release.changes.map((change, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        typeColors[change.type]
                      }`}
                    >
                      {typeLabels[change.type]}
                    </span>
                    <p className="text-gray-700 flex-1 pt-0.5">
                      {change.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500">
            Looking for older releases?{" "}
            <a
              href="https://github.com/yourusername/daily-dose-bot/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
