import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  Terminal,
  Database,
  Users,
  Play,
  Settings,
  CheckCircle,
  AlertCircle,
  Book,
  History,
} from 'lucide-react';
import { Navbar } from '../components';
import { ScriptsTOC, ScriptCard } from '../components/scripts';
import { CodeBlock } from '../components/docs';
import { BasicAuth } from '../components/auth';
import scriptsData from '../data/scripts.json';
import type { ScriptsData } from '../types/scripts';

export const meta = () => {
  return [
    { title: 'Scripts Documentation - Daily Dose | Admin Tools Guide' },
    {
      name: 'description',
      content:
        'Daily Dose Scripts Documentation - Complete guide for utility scripts and database operations. Administrative tools and automation scripts.',
    },
    {
      name: 'keywords',
      content:
        'daily dose scripts, automation scripts, database utilities, admin tools, team management scripts',
    },
    { name: 'author', content: 'Daily Dose' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: '/scripts-docs' },
    { property: 'og:title', content: 'Daily Dose Scripts Documentation - Admin Tools Guide' },
    {
      property: 'og:description',
      content:
        'Comprehensive documentation for Daily Dose administrative scripts including database operations, team management, and automation tools.',
    },
    { property: 'og:image', content: '/logo.png' },
    { property: 'twitter:card', content: 'summary_large_image' },
    { property: 'twitter:url', content: '/scripts-docs' },
    { property: 'twitter:title', content: 'Daily Dose Scripts Documentation - Admin Tools Guide' },
    {
      property: 'twitter:description',
      content:
        'Comprehensive documentation for Daily Dose administrative scripts including database operations, team management, and automation tools.',
    },
    { property: 'twitter:image', content: '/logo.png' },
  ];
};

const Scripts = () => {
  const data = scriptsData as ScriptsData;
  const [activeScript, setActiveScript] = useState(data.categories[0]?.scripts[0]?.id || '');

  const iconMap: Record<string, React.ElementType> = {
    database: Database,
    users: Users,
    robot: Play,
    settings: Settings,
  };

  return (
    <BasicAuth>
      <div className="min-h-screen bg-bg-primary text-text-primary transition-colors duration-300">
        <Navbar />

        {/* Main content */}
        <main className="pt-16 overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
            {/* Header */}
            <div className="mb-12">
              <div className="bg-linear-to-r from-purple-600 to-blue-600 p-6 md:p-8 rounded-xl mb-8">
                <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 flex items-center gap-3">
                  <Terminal className="w-8 h-8 md:w-12 md:h-12" />
                  Scripts Overview
                </h1>
                <p className="text-base md:text-xl text-white/90 mb-6">{data.overview.description}</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <Link
                    to="/docs"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/10 text-white font-semibold rounded-lg transition-colors"
                  >
                    <Book size={20} />
                    Main Documentation
                  </Link>
                  <Link
                    to="/changelog"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/10 text-white font-semibold rounded-lg transition-colors"
                  >
                    <History size={20} />
                    Changelog
                  </Link>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-8">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-400 mb-2">
                      {data.overview.warning.title}
                    </h4>
                    <p className="text-red-300/90">{data.overview.warning.description}</p>
                  </div>
                </div>
              </div>

              {/* Categories Overview */}
              <div className="grid md:grid-cols-2 gap-6 mb-12">
                {data.overview.categories.map((category, index) => {
                  const Icon = iconMap[category.icon] || Database;
                  return (
                    <div
                      key={index}
                      className="bg-bg-surface border border-border-default p-4 md:p-6 rounded-lg"
                    >
                      <h3 className="text-base md:text-lg font-semibold mb-3 flex items-center gap-2">
                        <Icon size={20} className={category.iconColor} />
                        <span className="text-text-primary">{category.title}</span>
                      </h3>
                      <p className="text-sm md:text-base text-text-secondary mb-4">{category.description}</p>
                      <ul className="text-sm text-text-secondary space-y-1">
                        {category.highlights.map((highlight, hIndex) => (
                          <li key={hIndex}>• {highlight}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prerequisites */}
            <section className="mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6 flex items-center gap-2">
                <CheckCircle size={32} className="text-blue-500" />
                Prerequisites
              </h2>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-400 mb-2">Before Running Scripts</h4>
                    <p className="text-blue-300/90">
                      Ensure you have the proper environment setup and permissions before executing
                      any administrative scripts.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-bg-surface border border-border-default p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Environment Setup</h3>
                  <CodeBlock>{data.prerequisites.environmentSetup}</CodeBlock>
                </div>

                <div className="bg-bg-surface border border-border-default p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Required Permissions</h3>
                  <ul className="space-y-2">
                    {data.prerequisites.requiredPermissions.map((perm, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle size={20} className="text-green-500 mt-0.5" />
                        <span className="text-text-secondary">
                          <strong className="text-text-primary">{perm.title}:</strong> {perm.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-bg-surface border border-border-default p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">General Usage Pattern</h3>
                  <CodeBlock>{data.prerequisites.generalUsage}</CodeBlock>
                </div>
              </div>
            </section>

            {/* Scripts Grid with TOC */}
            <div className="grid lg:grid-cols-[1fr_300px] gap-8">
              {/* Scripts */}
              <div className="min-w-0">
                {data.categories.map((category) => (
                  <section key={category.id} className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6 flex items-center gap-2">
                      {React.createElement(iconMap[category.icon] || Database, {
                        size: 32,
                        className: category.iconColor,
                      })}
                      {category.title}
                    </h2>
                    {category.scripts.map((script) => (
                      <ScriptCard key={script.id} script={script} />
                    ))}
                  </section>
                ))}
              </div>

              {/* Table of Contents - Right Side */}
              <div className="hidden lg:block">
                <ScriptsTOC
                  data={data}
                  activeScript={activeScript}
                  setActiveScript={setActiveScript}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </BasicAuth>
  );
};

export default Scripts;
