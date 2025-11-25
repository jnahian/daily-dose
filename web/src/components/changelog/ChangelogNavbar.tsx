import { Link } from 'react-router';
import { Home } from 'lucide-react';

export const ChangelogNavbar = () => {
  return (
    <nav className="fixed w-full z-50 bg-brand-navy/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Daily Dose Logo" className="w-8 h-8 rounded-lg" />
            <span className="text-white font-bold text-xl tracking-tight">Daily Dose</span>
          </Link>

          <Link
            to="/"
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <Home size={18} />
            <span className="hidden sm:inline">Back to Home</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};
