import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Navbar } from '../components';
import { DocsSidebar, ContentSection, ContentRenderer } from '../components/docs';
import docsData from '../data/docs.json';
import type { DocsData } from '../types/docs';

export const meta = () => {
    return [
        { title: 'Documentation - Daily Dose | Slack Bot Setup Guide' },
        { name: 'description', content: 'Daily Dose Documentation - Complete guide for setting up and using the Slack standup bot. Commands, setup instructions, and troubleshooting.' },
        { name: 'keywords', content: 'daily dose docs, slack bot documentation, standup automation, team management guide' },
        { name: 'author', content: 'Daily Dose' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: '/docs' },
        { property: 'og:title', content: 'Daily Dose Documentation - Complete Setup Guide' },
        { property: 'og:description', content: 'Comprehensive documentation for Daily Dose Slack bot including commands, setup instructions, and troubleshooting.' },
        { property: 'og:image', content: '/logo.png' },
        { property: 'twitter:card', content: 'summary_large_image' },
        { property: 'twitter:url', content: '/docs' },
        { property: 'twitter:title', content: 'Daily Dose Documentation - Complete Setup Guide' },
        { property: 'twitter:description', content: 'Comprehensive documentation for Daily Dose Slack bot including commands, setup instructions, and troubleshooting.' },
        { property: 'twitter:image', content: '/logo.png' },
    ];
};


const Docs = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('getting-started');
    const [searchQuery, setSearchQuery] = useState('');

    const data = docsData as DocsData;

    const filteredSections = data.sections.map(section => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return section;

        const sectionMatches = section.title.toLowerCase().includes(query);

        // If section matches, include all subsections
        if (sectionMatches) {
            return section;
        }

        // Otherwise check for matching subsections
        const matchingSubsections = section.subsections.filter(sub =>
            sub.title.toLowerCase().includes(query)
        );

        if (matchingSubsections.length > 0) {
            return {
                ...section,
                subsections: matchingSubsections
            };
        }

        return null;
    }).filter((section): section is typeof data.sections[0] => section !== null);

    return (
        <div className="min-h-screen bg-brand-navy text-white">
            <Navbar />

            {/* Mobile menu button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="fixed bottom-6 right-6 md:hidden z-50 w-12 h-12 bg-brand-cyan rounded-full flex items-center justify-center shadow-lg hover:shadow-brand-cyan/50 transition-shadow"
            >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <DocsSidebar
                isOpen={sidebarOpen}
                setIsOpen={setSidebarOpen}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
            />

            {/* Main content */}
            <main className="pt-16 md:pl-64">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {/* Header */}
                    <div className="mb-12">
                        <h1 className="text-5xl font-bold text-white mb-4">Documentation</h1>
                        <p className="text-xl text-gray-400">
                            Everything you need to know about using Daily Dose for your team's standups.
                        </p>
                    </div>

                    {/* Render sections from JSON */}
                    {filteredSections.length > 0 ? (
                        filteredSections.map((section) => (
                            <ContentSection key={section.id} id={section.id} title={section.title}>
                                {section.description && (
                                    <p className="text-gray-300 mb-6">{section.description}</p>
                                )}

                                {section.subsections.map((subsection) => (
                                    <div key={subsection.id} id={subsection.id} className="mt-8">
                                        <h3 className="text-2xl font-bold text-white mb-4">{subsection.title}</h3>
                                        <ContentRenderer content={subsection.content} />
                                    </div>
                                ))}
                            </ContentSection>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-xl text-gray-400">No results found for "{searchQuery}"</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Docs;
