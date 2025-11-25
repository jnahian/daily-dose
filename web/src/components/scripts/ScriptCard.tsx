import React from 'react';
import {
  Database,
  Users,
  Play,
  Bug,
  Settings,
  Sprout,
  UserCheck,
  Send,
  Info,
  Cog,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { Script } from '../../types/scripts';
import { CodeBlock } from '../docs';

interface ScriptCardProps {
  script: Script;
}

const iconMap: Record<string, React.ElementType> = {
  database: Database,
  users: Users,
  play: Play,
  bug: Bug,
  settings: Settings,
  seedling: Sprout,
  'user-check': UserCheck,
  'paper-plane': Send,
  info: Info,
  cog: Cog,
};

const noteIcons = {
  info: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  danger: XCircle,
};

const noteStyles = {
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  success: 'bg-green-500/10 border-green-500/30 text-green-400',
  danger: 'bg-red-500/10 border-red-500/30 text-red-400',
};

export const ScriptCard = ({ script }: ScriptCardProps) => {
  const Icon = iconMap[script.icon] || Database;

  return (
    <div
      id={`script-${script.id}`}
      className="bg-brand-navy-light rounded-xl border border-white/10 p-8 mb-8 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-3 bg-white/5 rounded-lg border border-white/10`}>
          <Icon size={24} className={script.iconColor} />
        </div>
        <h3 className="text-2xl font-bold text-white">{script.name}</h3>
      </div>

      {/* Purpose */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-white mb-2">Purpose</h4>
        <p className="text-gray-300">{script.purpose}</p>
      </div>

      {/* Usage Note */}
      {script.usageNote && (
        <div className={`p-4 rounded-lg border mb-6 ${noteStyles[script.usageNote.type]}`}>
          <div className="flex items-start gap-3">
            {React.createElement(noteIcons[script.usageNote.type], {
              size: 20,
              className: 'mt-0.5',
            })}
            <div>
              <h5 className="font-semibold mb-1">{script.usageNote.title}</h5>
              <p className="text-sm opacity-90">{script.usageNote.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Examples */}
      {script.examples && script.examples.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-3">Usage</h4>
          {script.examples.map((example, index) => (
            <div key={index} className="mb-4">
              {example.description && (
                <p className="text-gray-400 text-sm mb-2">{example.description}</p>
              )}
              <CodeBlock>{example.code}</CodeBlock>
            </div>
          ))}
        </div>
      )}

      {/* Parameters */}
      {script.parameters && script.parameters.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-3">Parameters</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 font-semibold text-gray-300">Parameter</th>
                  <th className="text-left py-2 font-semibold text-gray-300">Type</th>
                  <th className="text-left py-2 font-semibold text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                {script.parameters.map((param, index) => (
                  <tr key={index} className="border-b border-white/10">
                    <td className="py-2 font-mono text-brand-cyan">{param.name}</td>
                    <td className="py-2">{param.type}</td>
                    <td className="py-2">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* What It Does */}
      {script.whatItDoes && script.whatItDoes.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-3">What It Does</h4>
          <ol className="space-y-2">
            {script.whatItDoes.map((step, index) => (
              <li key={index} className="flex items-start gap-3 text-gray-300">
                <span className="bg-brand-cyan text-white text-xs px-2 py-1 rounded-full font-mono min-w-[24px] text-center">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Features */}
      {script.features && script.features.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-3">
            {script.features.length > 1 ? 'Features' : 'What It Creates'}
          </h4>
          <div className="grid md:grid-cols-2 gap-4">
            {script.features.map((feature, index) => (
              <div key={index} className="border border-white/10 p-4 rounded-lg bg-white/5">
                <h5 className="font-semibold text-brand-cyan mb-2">{feature.title}</h5>
                <ul className="text-sm text-gray-400 space-y-1">
                  {feature.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prerequisites */}
      {script.prerequisites && script.prerequisites.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-yellow-400 mt-0.5" />
            <div>
              <h5 className="font-semibold text-yellow-400 mb-2">Important Notes</h5>
              <ul className="space-y-1 text-sm text-yellow-300/90">
                {script.prerequisites.map((note, index) => (
                  <li key={index}>• {note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
