
import { ChevronRight } from 'lucide-react';

interface TableOfContentsProps {
  versions: Array<{ version: string; date: string }>;
  activeVersion: string;
  setActiveVersion: (version: string) => void;
}

export const TableOfContents = ({
  versions,
  activeVersion,
  setActiveVersion,
}: TableOfContentsProps) => {
  const scrollToVersion = (version: string) => {
    setActiveVersion(version);
    const element = document.getElementById(`version-${version}`);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="sticky top-24 bg-brand-navy-light border border-white/10 rounded-xl p-6 h-fit">
      <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Versions</h3>
      <nav className="space-y-2">
        {versions.map((version) => (
          <button
            key={version.version}
            onClick={() => scrollToVersion(version.version)}
            className={`
              w-full text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center gap-2
              ${activeVersion === version.version ? 'bg-brand-cyan/10 text-brand-cyan' : 'text-gray-400 hover:text-white hover:bg-white/5'}
            `}
          >
            <ChevronRight
              size={14}
              className={activeVersion === version.version ? 'opacity-100' : 'opacity-0'}
            />
            <div className="flex-1">
              <div className="font-semibold">v{version.version}</div>
              <div className="text-xs opacity-75">{version.date}</div>
            </div>
          </button>
        ))}
      </nav>
    </div>
  );
};
