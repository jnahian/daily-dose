

interface CodeBlockProps {
  children: string;
}

export const CodeBlock = ({ children }: CodeBlockProps) => (
  <div className="relative group">
    <pre className="bg-bg-surface border border-border-default rounded-lg p-4 overflow-x-auto">
      <code className="text-sm text-text-secondary">{children}</code>
    </pre>
  </div>
);
