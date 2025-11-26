import React from 'react';
import { Link, useLocation } from 'react-router';
import { Terminal, History, Book, Slack, Menu, X, Home as HomeIcon, Network } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

// Define menu structure
interface MenuItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  submenu?: { label: string; path: string; icon?: React.ReactNode }[];
  scrollTo?: string;
}

export const Navbar = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isOpen, setIsOpen] = React.useState(false);

  // Determine page type


  // Menu items configuration
  const menuItems: MenuItem[] = [
    {
      label: 'Home',
      path: '/',
      icon: <HomeIcon size={18} />,
      submenu: [
        { label: 'Features', path: '/#features', icon: <Book size={18} /> },
        { label: 'How It Works', path: '/#how-it-works', icon: <Network size={18} /> },
        { label: 'Documentation', path: '/docs', icon: <Book size={18} /> },
      ],
    },
    {
      label: 'Documentation',
      path: '/docs',
      icon: <Book size={18} />,
      submenu: [
        { label: 'Documentation', path: '/docs', icon: <Book size={18} /> },
        { label: 'Changelog', path: '/changelog', icon: <History size={18} /> },
        { label: 'Scripts', path: '/scripts', icon: <Terminal size={18} /> },
      ],
    },
    {
      label: 'Changelog',
      path: '/changelog',
      icon: <History size={18} />,
      submenu: [
        { label: 'Documentation', path: '/docs', icon: <Book size={18} /> },
        { label: 'Changelog', path: '/changelog', icon: <History size={18} /> },
        { label: 'Scripts', path: '/scripts', icon: <Terminal size={18} /> },
      ],
    },
    {
      label: 'Scripts',
      path: '/scripts',
      icon: <Terminal size={18} />,
      submenu: [
        { label: 'Documentation', path: '/docs', icon: <Book size={18} /> },
        { label: 'Changelog', path: '/changelog', icon: <History size={18} /> },
        { label: 'Scripts', path: '/scripts', icon: <Terminal size={18} /> },
      ],
    },
  ];

  // Find active menu item to determine submenu
  const activeMenuItem = menuItems.find(item =>
    item.path === '/' ? currentPath === '/' : currentPath.includes(item.path!)
  ) || menuItems[0];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    setIsOpen(false);
    if (path.includes('#')) {
      const [basePath, hash] = path.split('#');
      if (basePath === '/' && currentPath === '/') {
        e.preventDefault();
        const element = document.getElementById(hash);
        if (element) {
          const offset = 80;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      }
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath.includes(path);
  };

  return (
    <nav className="fixed w-full z-50 bg-bg-primary/80 backdrop-blur-md border-b border-border-default transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Daily Dose Logo" className="w-8 h-8 rounded-lg" />
            <span className="text-text-primary font-bold text-xl tracking-tight">Daily Dose</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2">
              {activeMenuItem.submenu?.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${isActive(item.path) ? 'text-brand-cyan' : 'text-text-secondary hover:text-brand-cyan'
                    }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>

            <button className="bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-cyan px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 border border-brand-blue/20">
              <Slack size={16} />
              Add to Slack
            </button>

            <div className="ml-2 pl-2 border-l border-border-default">
              <ThemeToggle />
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-4 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-text-secondary hover:text-text-primary p-2"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-bg-primary border-b border-border-default">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {activeMenuItem.submenu?.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                onClick={(e) => handleLinkClick(e, item.path)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${isActive(item.path) ? 'text-brand-cyan' : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};
