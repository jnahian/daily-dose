import React from 'react';
import { Link, useLocation } from 'react-router';
import { Home, Terminal, History, Book, Slack, Menu, X } from 'lucide-react';

export const Navbar = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isOpen, setIsOpen] = React.useState(false);

  // Determine page type
  const isScriptsPage = currentPath.includes('/scripts');
  const isDocsPage = currentPath.includes('/docs');
  const isChangelogPage = currentPath.includes('/changelog');
  const isHomePage = currentPath === '/';

  // Scroll functions for home page
  const scrollToTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsOpen(false);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
    setIsOpen(false);
  };

  return (
    <nav className="fixed w-full z-50 bg-brand-navy/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Daily Dose Logo" className="w-8 h-8 rounded-lg" />
            <div>
              <span className="text-white font-bold text-xl tracking-tight">Daily Dose</span>
              {isScriptsPage && <span className="text-gray-400 text-sm ml-2">Scripts Docs</span>}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {/* Home Page Navigation */}
            {isHomePage && (
              <>
                <div className="flex items-baseline space-x-8 mr-4">
                  <a
                    href="#"
                    onClick={scrollToTop}
                    className="text-gray-300 hover:text-brand-cyan px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
                  >
                    Home
                  </a>
                  <a
                    href="#features"
                    onClick={(e) => scrollToSection(e, 'features')}
                    className="text-gray-300 hover:text-brand-cyan px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
                  >
                    Features
                  </a>
                  <a
                    href="#how-it-works"
                    onClick={(e) => scrollToSection(e, 'how-it-works')}
                    className="text-gray-300 hover:text-brand-cyan px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
                  >
                    How it Works
                  </a>
                  <Link
                    to="/docs"
                    className="text-gray-300 hover:text-brand-cyan px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Documentation
                  </Link>
                </div>
                <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 border border-white/10">
                  <Slack size={16} />
                  Add to Slack
                </button>
              </>
            )}

            {/* Scripts Page */}
            {isScriptsPage && (
              <>
                <span className="px-3 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                  🔐 Admin Only
                </span>
                <Link
                  to="/docs"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Book size={18} />
                  <span className="hidden sm:inline">Documentation</span>
                </Link>
              </>
            )}

            {/* Docs Page */}
            {isDocsPage && (
              <>
                <Link
                  to="/scripts"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Terminal size={18} />
                  <span className="hidden sm:inline">Scripts</span>
                </Link>
                <Link
                  to="/changelog"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <History size={18} />
                  <span className="hidden sm:inline">Changelog</span>
                </Link>
              </>
            )}

            {/* Changelog Page */}
            {isChangelogPage && (
              <Link
                to="/docs"
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <Book size={18} />
                <span className="hidden sm:inline">Documentation</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          {isHomePage && (
            <div className="-mr-2 flex md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-400 hover:text-white p-2"
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu (Home Page Only) */}
      {isHomePage && isOpen && (
        <div className="md:hidden bg-brand-navy border-b border-white/10">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <a
              href="#"
              onClick={scrollToTop}
              className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium cursor-pointer"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium cursor-pointer"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium cursor-pointer"
            >
              How it Works
            </a>
            <Link
              to="/docs"
              className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
            >
              Documentation
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};
