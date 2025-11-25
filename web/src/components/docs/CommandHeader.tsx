import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CommandHeaderProps {
  command: string;
}

export const CommandHeader = ({ command }: CommandHeaderProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-4 mb-2 group">
      <h4 className="text-lg font-semibold text-brand-cyan">{command}</h4>
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
      >
        {copied ? (
          <>
            <Check size={14} className="text-green-400" />
            <span className="text-green-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy size={14} />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
};
