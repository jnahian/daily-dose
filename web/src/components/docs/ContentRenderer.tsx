import React from 'react';
import { CommandHeader } from './CommandHeader';
import { CodeBlock } from './CodeBlock';
import type { ContentItem } from '../../types/docs';

interface ContentRendererProps {
    content: ContentItem[];
}

export const ContentRenderer = ({ content }: ContentRendererProps) => {
    return (
        <>
            {content.map((item, index) => {
                switch (item.type) {
                    case 'text':
                        return (
                            <p key={index} className="text-gray-300 mb-4">
                                {item.value}
                            </p>
                        );

                    case 'command':
                        return (
                            <div key={index} className="mb-6">
                                <CommandHeader command={item.command!} />
                                <p className="text-gray-300 mb-3">{item.description}</p>
                                {item.examples && item.examples.length > 0 && (
                                    <CodeBlock>{item.examples.join('\n\n')}</CodeBlock>
                                )}
                            </div>
                        );

                    case 'code':
                        return (
                            <div key={index} className="mb-4">
                                <CodeBlock>{item.value!}</CodeBlock>
                            </div>
                        );

                    case 'list':
                        return (
                            <ul key={index} className="list-disc list-inside space-y-2 text-gray-300 ml-4 mb-4">
                                {item.items?.map((listItem, i) => (
                                    <li key={i}>{listItem}</li>
                                ))}
                            </ul>
                        );

                    case 'note':
                        return (
                            <div key={index} className="bg-brand-navy-light border border-brand-cyan/30 rounded-lg p-4 my-4">
                                <p className="text-sm text-brand-cyan font-semibold mb-2">{item.title}</p>
                                <p className="text-sm text-gray-300">{item.value}</p>
                            </div>
                        );

                    case 'warning':
                        return (
                            <div key={index} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                                <p className="text-sm text-yellow-400 font-semibold mb-2">{item.title}</p>
                                <p className="text-sm text-gray-300">{item.value}</p>
                            </div>
                        );

                    default:
                        return null;
                }
            })}
        </>
    );
};
