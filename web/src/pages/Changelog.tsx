import { useState } from 'react';
import { Link } from 'react-router';
import {
  History,
  Github,
  Book,
  Check,
  AlertCircle,
  Wrench,
  Shield,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { Navbar } from '../components';
import { VersionCard, TableOfContents } from '../components/changelog';
import changelogData from '../data/changelog.json';
import type { ChangelogData } from '../types/changelog';

export const meta = () => {
  return [
    { title: 'Changelog - Daily Dose | Release Notes & Version History' },
    {
      name: 'description',
      content:
        'Daily Dose Changelog - Track all updates, new features, and improvements to the Slack standup bot. Stay informed about the latest releases.',
    },
    {
      name: 'keywords',
      content: 'daily dose changelog, release notes, version history, slack bot updates',
    },
    { name: 'author', content: 'Daily Dose' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: '/changelog' },
    { property: 'og:title', content: 'Daily Dose Changelog - Release Notes & Updates' },
    {
      property: 'og:description',
      content:
        'Track all updates, new features, and improvements to Daily Dose Slack bot. View complete version history.',
    },
    { property: 'og:image', content: '/logo.png' },
    { property: 'twitter:card', content: 'summary_large_image' },
    { property: 'twitter:url', content: '/changelog' },
    { property: 'twitter:title', content: 'Daily Dose Changelog - Release Notes & Updates' },
    {
      property: 'twitter:description',
      content:
        'Track all updates, new features, and improvements to Daily Dose Slack bot. View complete version history.',
    },
    { property: 'twitter:image', content: '/logo.png' },
  ];
};

const Changelog = () => {
  const data = changelogData as ChangelogData;
  const [activeVersion, setActiveVersion] = useState(data.versions[0]?.version || '');

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary transition-colors duration-300">
      <Navbar />

      {/* Main content */}
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-text-primary mb-4 flex items-center gap-3">
              <History size={48} className="text-brand-cyan" />
              Changelog
            </h1>
            <p className="text-xl text-text-secondary mb-8">
              Track all updates, new features, and improvements to Daily Dose. We follow{' '}
              <a
                href="https://semver.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-cyan hover:text-brand-blue underline transition-colors"
              >
                Semantic Versioning
              </a>{' '}
              and keep detailed release notes.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <a
                href="https://github.com/jnahian/daily-dose/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-bg-surface hover:bg-bg-surface/80 border border-border-default text-text-primary font-semibold rounded-lg transition-colors"
              >
                <Github size={20} />
                View on GitHub
              </a>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-cyan hover:bg-brand-blue text-white font-semibold rounded-lg transition-colors"
              >
                <Book size={20} />
                Documentation
              </Link>
            </div>
          </div>

          {/* Content Grid with TOC */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-8">
            {/* Versions */}
            <div className="space-y-8">
              {data.versions.map((version) => (
                <VersionCard
                  key={version.version}
                  version={version.version}
                  date={version.date}
                  isLatest={version.isLatest}
                  changes={version.changes}
                />
              ))}

              {/* Legend */}
              <div className="mt-16 bg-bg-surface border border-border-default rounded-xl p-8">
                <h2 className="text-2xl font-bold text-text-primary mb-6 text-center">
                  Change Categories
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-bg-primary rounded-lg p-4 text-center border border-border-default">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded-full text-xs font-semibold uppercase">
                      <Check size={14} />
                      Added
                    </span>
                    <p className="text-sm text-text-secondary mt-2">New features</p>
                  </div>
                  <div className="bg-bg-primary rounded-lg p-4 text-center border border-border-default">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-semibold uppercase">
                      <AlertCircle size={14} />
                      Changed
                    </span>
                    <p className="text-sm text-text-secondary mt-2">Changes</p>
                  </div>
                  <div className="bg-bg-primary rounded-lg p-4 text-center border border-border-default">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500 text-white rounded-full text-xs font-semibold uppercase">
                      <AlertTriangle size={14} />
                      Deprecated
                    </span>
                    <p className="text-sm text-text-secondary mt-2">Soon removed</p>
                  </div>
                  <div className="bg-bg-primary rounded-lg p-4 text-center border border-border-default">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-500 text-white rounded-full text-xs font-semibold uppercase">
                      <Trash2 size={14} />
                      Removed
                    </span>
                    <p className="text-sm text-text-secondary mt-2">Removed</p>
                  </div>
                  <div className="bg-bg-primary rounded-lg p-4 text-center border border-border-default">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-semibold uppercase">
                      <Wrench size={14} />
                      Fixed
                    </span>
                    <p className="text-sm text-text-secondary mt-2">Bug fixes</p>
                  </div>
                  <div className="bg-bg-primary rounded-lg p-4 text-center border border-border-default">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white rounded-full text-xs font-semibold uppercase">
                      <Shield size={14} />
                      Security
                    </span>
                    <p className="text-sm text-text-secondary mt-2">Security</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Table of Contents - Right Side */}
            <div className="hidden lg:block">
              <TableOfContents
                versions={data.versions.map((v) => ({ version: v.version, date: v.date }))}
                activeVersion={activeVersion}
                setActiveVersion={setActiveVersion}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Changelog;
