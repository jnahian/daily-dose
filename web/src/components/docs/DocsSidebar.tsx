import React from 'react';
import {
    Search,
    ChevronRight,
    Book,
    Zap,
    Settings,
    Wrench,
    HelpCircle,
    LifeBuoy,
    SquareSlash
} from 'lucide-react';

interface NavItem {
    id: string;
    title: string;
    icon: React.ElementType;
    subsections?: { id: string; title: string }[];
}

interface DocsSidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    activeSection: string;
    setActiveSection: (section: string) => void;
}

export const DocsSidebar = ({
    isOpen,
    setIsOpen,
    activeSection,
    setActiveSection
}: DocsSidebarProps) => {
    const navItems: NavItem[] = [
        {
            id: 'getting-started',
            title: 'Getting Started',
            icon: Book,
            subsections: [
                { id: 'overview', title: 'Overview' },
                { id: 'installation', title: 'Installation' },
                { id: 'first-steps', title: 'First Steps' },
            ]
        },
        {
            id: 'slash-commands',
            title: 'Slash Commands',
            icon: SquareSlash,
            subsections: [
                { id: 'standup-commands', title: 'Standup Commands' },
                { id: 'team-commands', title: 'Team Management' },
                { id: 'leave-commands', title: 'Leave Management' },
                { id: 'holiday-commands', title: 'Holiday Management' },
                { id: 'workdays-commands', title: 'Work Days' },
                { id: 'admin-commands', title: 'Admin Commands' },
            ]
        },
        {
            id: 'features',
            title: 'Features',
            icon: Zap,
            subsections: [
                { id: 'automated-reminders', title: 'Automated Reminders' },
                { id: 'timezone-support', title: 'Timezone Support' },
                { id: 'notifications', title: 'Admin Notifications' },
            ]
        },
        {
            id: 'configuration',
            title: 'Configuration',
            icon: Settings,
            subsections: [
                { id: 'team-setup', title: 'Team Setup' },
                { id: 'work-days', title: 'Work Days' },
                { id: 'holidays', title: 'Holidays' },
            ]
        },
        {
            id: 'troubleshooting',
            title: 'Troubleshooting',
            icon: Wrench,
            subsections: [
                { id: 'common-issues', title: 'Common Issues' },
            ]
        },
        {
            id: 'faq',
            title: 'FAQ',
            icon: HelpCircle,
            subsections: [
                { id: 'general-questions', title: 'General Questions' },
            ]
        },
        {
            id: 'support',
            title: 'Support',
            icon: LifeBuoy,
            subsections: [
                { id: 'get-help', title: 'Getting Help' },
            ]
        },
    ];

    const scrollToSection = (sectionId: string) => {
        setActiveSection(sectionId);
        const element = document.getElementById(sectionId);
        if (element) {
            const offset = 100;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
        setIsOpen(false);
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-brand-navy-light border-r border-white/10 
        transform transition-transform duration-300 z-40 overflow-y-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
                <div className="p-6">
                    {/* Search */}
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search docs..."
                            className="w-full bg-brand-navy border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan/50 transition-colors"
                        />
                    </div>

                    {/* Navigation */}
                    <nav className="space-y-6">
                        {navItems.map((item) => (
                            <div key={item.id}>
                                <button
                                    onClick={() => scrollToSection(item.id)}
                                    className={`
                    w-full text-left font-semibold text-sm mb-2 transition-colors flex items-center gap-2
                    ${activeSection === item.id ? 'text-brand-cyan' : 'text-white hover:text-brand-cyan'}
                  `}
                                >
                                    <item.icon size={18} />
                                    {item.title}
                                </button>
                                {item.subsections && (
                                    <ul className="space-y-2 ml-3 border-l border-white/10">
                                        {item.subsections.map((sub) => (
                                            <li key={sub.id}>
                                                <button
                                                    onClick={() => scrollToSection(sub.id)}
                                                    className={`
                            w-full text-left text-sm pl-3 py-1 transition-colors flex items-center gap-2
                            ${activeSection === sub.id ? 'text-brand-cyan' : 'text-gray-400 hover:text-white'}
                          `}
                                                >
                                                    <ChevronRight size={14} className={activeSection === sub.id ? 'opacity-100' : 'opacity-0'} />
                                                    {sub.title}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </nav>
                </div>
            </aside>
        </>
    );
};
