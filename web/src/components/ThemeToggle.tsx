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
        <div className="flex items-center gap-1 border rounded-full p-1" style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)'
        }}>
            <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-full transition-all ${theme === 'light'
                    ? 'bg-white text-brand-navy shadow-sm'
                    : ''
                    }`}
                style={theme !== 'light' ? {
                    color: 'var(--text-secondary)'
                } : {}}
                onMouseEnter={(e) => {
                    if (theme !== 'light') {
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (theme !== 'light') {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                }}
                aria-label="Light mode"
            >
                <Sun size={14} />
            </button>
            <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-full transition-all ${theme === 'system'
                    ? 'bg-white text-brand-navy shadow-sm'
                    : ''
                    }`}
                style={theme !== 'system' ? {
                    color: 'var(--text-secondary)'
                } : {}}
                onMouseEnter={(e) => {
                    if (theme !== 'system') {
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (theme !== 'system') {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                }}
                aria-label="System theme"
            >
                <Laptop size={14} />
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-full transition-all ${theme === 'dark'
                    ? 'bg-white text-brand-navy shadow-sm'
                    : ''
                    }`}
                style={theme !== 'dark' ? {
                    color: 'var(--text-secondary)'
                } : {}}
                onMouseEnter={(e) => {
                    if (theme !== 'dark') {
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (theme !== 'dark') {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                }}
                aria-label="Dark mode"
            >
                <Moon size={14} />
            </button>
        </div>
    );
}
