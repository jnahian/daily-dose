

interface CodeBlockProps {
  children: string;
}

export const CodeBlock = ({ children }: CodeBlockProps) => (
  <div className="relative group">
    <pre className="bg-brand-navy-light border border-white/10 rounded-lg p-4 overflow-x-auto">
      <code className="text-sm text-gray-300">{children}</code>
    </pre>
  </div>
);
