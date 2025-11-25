import React from 'react';

interface ContentSectionProps {
    id: string;
    title: string;
    children: React.ReactNode;
}

export const ContentSection = ({ id, title, children }: ContentSectionProps) => (
    <section id={id} className="mb-16 scroll-mt-24">
        <h2 className="text-3xl font-bold text-white mb-6 border-b border-white/10 pb-4">{title}</h2>
        <div className="prose prose-invert max-w-none">
            {children}
        </div>
    </section>
);
