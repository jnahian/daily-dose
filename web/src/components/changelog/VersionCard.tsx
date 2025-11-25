import React from 'react';
import { Check, AlertCircle, Wrench, Shield, AlertTriangle, Trash2 } from 'lucide-react';
import type { ChangeItem } from '../../types/changelog';

interface VersionCardProps {
    version: string;
    date: string;
    isLatest: boolean;
    changes: ChangeItem[];
}

const getBadgeStyles = (type: ChangeItem['type']) => {
    const styles = {
        added: 'bg-green-500 text-white',
        changed: 'bg-blue-500 text-white',
        fixed: 'bg-amber-500 text-white',
        security: 'bg-red-500 text-white',
        deprecated: 'bg-purple-500 text-white',
        removed: 'bg-gray-500 text-white',
    };
    return styles[type];
};

const getIcon = (type: ChangeItem['type']) => {
    const icons = {
        added: <Check size={16} />,
        changed: <AlertCircle size={16} />,
        fixed: <Wrench size={16} />,
        security: <Shield size={16} />,
        deprecated: <AlertTriangle size={16} />,
        removed: <Trash2 size={16} />,
    };
    return icons[type];
};

export const VersionCard = ({ version, date, isLatest, changes }: VersionCardProps) => {
    return (
        <div className={`bg-white rounded-xl shadow-lg p-8 mb-8 transition-all hover:-translate-y-1 hover:shadow-xl ${isLatest ? 'border-2 border-brand-cyan shadow-brand-cyan/20' : ''}`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-lg font-bold text-xl ${isLatest ? 'bg-gradient-to-r from-brand-cyan to-brand-blue text-white' : 'bg-gray-800 text-white'}`}>
                        v{version}
                    </div>
                    <span className="text-gray-500 text-sm">{date}</span>
                </div>
                {isLatest && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full uppercase tracking-wide">
                        Latest Release
                    </span>
                )}
            </div>

            <div className="space-y-6">
                {changes.map((change, index) => (
                    <div key={index}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${getBadgeStyles(change.type)}`}>
                                {getIcon(change.type)}
                                {change.type}
                            </span>
                            {change.title && <span className="text-gray-700">{change.title}</span>}
                        </h3>
                        <ul className="space-y-2 ml-4">
                            {change.items.map((item, itemIndex) => (
                                <li key={itemIndex} className="text-gray-700 flex items-start gap-2">
                                    <span className="text-brand-cyan mt-1">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};
