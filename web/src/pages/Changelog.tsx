import React from 'react';
import { Link } from 'react-router';
import { History, Github, Book, Check, AlertCircle, Wrench, Shield, AlertTriangle, Trash2 } from 'lucide-react';
import { ChangelogNavbar, VersionCard } from '../components/changelog';
import changelogData from '../data/changelog.json';
import type { ChangelogData } from '../types/changelog';

const Changelog = () => {
    const data = changelogData as ChangelogData;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <ChangelogNavbar />

            {/* Hero Section */}
            <section className="pt-32 pb-16 bg-gradient-to-r from-brand-cyan to-brand-blue">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3">
                        <History size={48} />
                        Changelog
                    </h1>
                    <p className="text-xl text-white/90 max-w-3xl mx-auto mb-8">
                        Track all updates, new features, and improvements to Daily Dose. We follow{' '}
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
                    <div className="flex justify-center items-center gap-4 flex-wrap">
                        <a
                            href="https://github.com/jnahian/daily-dose/releases"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-cyan font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <Github size={20} />
                            View on GitHub
                        </a>
                        <Link
                            to="/docs"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors"
                        >
                            <Book size={20} />
                            Documentation
                        </Link>
                    </div>
                </div>
            </section>

            {/* Versions */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {data.versions.map((version) => (
                        <VersionCard
                            key={version.version}
                            version={version.version}
                            date={version.date}
                            isLatest={version.isLatest}
                            changes={version.changes}
                        />
                    ))}
                </div>
            </section>

            {/* Legend */}
            <section className="py-12 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center flex items-center justify-center gap-2">
                        Change Categories
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-white rounded-lg p-4 text-center shadow">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded-full text-xs font-semibold uppercase">
                                <Check size={14} />
                                Added
                            </span>
                            <p className="text-sm text-gray-600 mt-2">New features</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center shadow">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-semibold uppercase">
                                <AlertCircle size={14} />
                                Changed
                            </span>
                            <p className="text-sm text-gray-600 mt-2">Changes in functionality</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center shadow">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500 text-white rounded-full text-xs font-semibold uppercase">
                                <AlertTriangle size={14} />
                                Deprecated
                            </span>
                            <p className="text-sm text-gray-600 mt-2">Soon-to-be removed</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center shadow">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-500 text-white rounded-full text-xs font-semibold uppercase">
                                <Trash2 size={14} />
                                Removed
                            </span>
                            <p className="text-sm text-gray-600 mt-2">Removed features</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center shadow">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-semibold uppercase">
                                <Wrench size={14} />
                                Fixed
                            </span>
                            <p className="text-sm text-gray-600 mt-2">Bug fixes</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center shadow">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white rounded-full text-xs font-semibold uppercase">
                                <Shield size={14} />
                                Security
                            </span>
                            <p className="text-sm text-gray-600 mt-2">Security patches</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Changelog;
