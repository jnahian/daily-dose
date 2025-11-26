import { Link } from 'react-router';
import { Home } from 'lucide-react';

export const ScriptsNavbar = () => {
  return (
    <nav className="fixed w-full z-50 bg-bg-primary/80 backdrop-blur-md border-b border-border-default transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Daily Dose Logo" className="w-8 h-8 rounded-lg" />
            <div>
              <span className="text-text-primary font-bold text-xl tracking-tight">Daily Dose</span>
              <span className="text-text-secondary text-sm ml-2">Scripts Docs</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <span className="px-3 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
              🔐 Admin Only
            </span>
            <Link
              to="/"
              className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
            >
              <Home size={18} />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
