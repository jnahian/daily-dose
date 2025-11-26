import React from 'react';
import { CommandHeader } from './CommandHeader';
import { CodeBlock } from './CodeBlock';
import type { ContentItem } from '../../types/docs';

interface ContentRendererProps {
  content: ContentItem[];
}

const formatText = (text: string) => {
  if (!text) return null;

  // Split by newlines first to handle paragraphs/breaks
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    // Process bold text: **text**
    const parts = line.split(/(\*\*.*?\*\*)/g);

    const formattedLine = parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="text-text-primary font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    return (
      <React.Fragment key={lineIndex}>
        {formattedLine}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

export const ContentRenderer = ({ content }: ContentRendererProps) => {
  return (
    <>
      {content.map((item, index) => {
        switch (item.type) {
          case 'text':
            return (
              <div key={index} className="text-text-secondary mb-4">
                {formatText(item.value!)}
              </div>
            );

          case 'command':
            return (
              <div key={index} className="mb-6">
                <CommandHeader command={item.command!} />
                <p className="text-text-secondary mb-3">{formatText(item.description!)}</p>
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
              <ul key={index} className="list-disc list-inside space-y-2 text-text-secondary ml-4 mb-4">
                {item.items?.map((listItem, i) => (
                  <li key={i}>{formatText(listItem)}</li>
                ))}
              </ul>
            );

          case 'note':
            return (
              <div
                key={index}
                className="bg-bg-surface border border-brand-cyan/30 rounded-lg p-4 my-4"
              >
                <p className="text-sm text-brand-cyan font-semibold mb-2">{item.title}</p>
                <div className="text-sm text-text-secondary">{formatText(item.value!)}</div>
              </div>
            );

          case 'warning':
            return (
              <div
                key={index}
                className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4"
              >
                <p className="text-sm text-yellow-400 font-semibold mb-2">{item.title}</p>
                <div className="text-sm text-text-secondary">{formatText(item.value!)}</div>
              </div>
            );

          default:
            return null;
        }
      })}
    </>
  );
};
