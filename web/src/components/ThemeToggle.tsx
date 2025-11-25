import { Moon, Sun, Laptop } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-9 h-9" />; // Placeholder
    }

    return (
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
            <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-full transition-all ${theme === 'light'
                        ? 'bg-white text-brand-navy shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                aria-label="Light mode"
            >
                <Sun size={14} />
            </button>
            <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-full transition-all ${theme === 'system'
                        ? 'bg-white text-brand-navy shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                aria-label="System theme"
            >
                <Laptop size={14} />
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-full transition-all ${theme === 'dark'
                        ? 'bg-white text-brand-navy shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                aria-label="Dark mode"
            >
                <Moon size={14} />
            </button>
        </div>
    );
}
