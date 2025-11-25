import React from 'react';
import { Link } from 'react-router';
import { Home, Github, Book } from 'lucide-react';

export const ChangelogNavbar = () => {
    return (
        <nav className="fixed w-full z-50 bg-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-brand-cyan to-brand-blue rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">D</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">Daily Dose</span>
                    </Link>

                    <div className="flex items-center gap-6">
                        <Link to="/" className="text-gray-600 hover:text-brand-cyan transition-colors flex items-center gap-2">
                            <Home size={18} />
                            <span className="hidden sm:inline">Home</span>
                        </Link>
                        <Link to="/docs" className="text-gray-600 hover:text-brand-cyan transition-colors flex items-center gap-2">
                            <Book size={18} />
                            <span className="hidden sm:inline">Docs</span>
                        </Link>
                        <a
                            href="https://github.com/jnahian/daily-dose"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-brand-cyan transition-colors"
                        >
                            <Github size={20} />
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    );
};
