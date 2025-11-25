import React from 'react';
import { Database, Users, Play, Bug, Settings, Sprout, UserCheck, Send, Info, Cog, ChevronRight } from 'lucide-react';
import type { ScriptsData } from '../../types/scripts';

interface ScriptsTOCProps {
    data: ScriptsData;
    activeScript: string;
    setActiveScript: (id: string) => void;
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

export const ScriptsTOC = ({ data, activeScript, setActiveScript }: ScriptsTOCProps) => {
    const scrollToScript = (scriptId: string) => {
        setActiveScript(scriptId);
        const element = document.getElementById(`script-${scriptId}`);
        if (element) {
            const offset = 100;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="sticky top-24 bg-brand-navy-light border border-white/10 rounded-xl p-6 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">
                Scripts
            </h3>
            <nav className="space-y-4">
                {data.categories.map((category) => {
                    const CategoryIcon = iconMap[category.icon] || Database;
                    return (
                        <div key={category.id}>
                            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-2">
                                <CategoryIcon size={14} className={category.iconColor} />
                                <span>{category.title}</span>
                            </div>
                            <div className="space-y-1 ml-4">
                                {category.scripts.map((script) => {
                                    const ScriptIcon = iconMap[script.icon] || Database;
                                    return (
                                        <button
                                            key={script.id}
                                            onClick={() => scrollToScript(script.id)}
                                            className={`
                        w-full text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center gap-2
                        ${activeScript === script.id ? 'bg-brand-cyan/10 text-brand-cyan' : 'text-gray-400 hover:text-white hover:bg-white/5'}
                      `}
                                        >
                                            <ChevronRight size={14} className={activeScript === script.id ? 'opacity-100' : 'opacity-0'} />
                                            <ScriptIcon size={14} className={script.iconColor} />
                                            <span className="truncate">{script.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>
        </div>
    );
};
