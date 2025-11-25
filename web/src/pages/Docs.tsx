import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { DocsNavbar, DocsSidebar, ContentSection, ContentRenderer } from '../components/docs';
import docsData from '../data/docs.json';
import type { DocsData } from '../types/docs';

const Docs = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('getting-started');

    const data = docsData as DocsData;

    return (
        <div className="min-h-screen bg-brand-navy text-white">
            <DocsNavbar />

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
                    {data.sections.map((section) => (
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
                    ))}
                </div>
            </main>
        </div>
    );
};

export default Docs;
