'use client';

import { useTheme } from './theme-provider';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`
            flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
            ${
              theme === value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }
          `}
          title={`Switch to ${label} mode`}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// Simple icon-only toggle (for compact spaces like nav bar)
export function ThemeToggleIcon() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const sequence: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = sequence.indexOf(theme);
    const nextIndex = (currentIndex + 1) % sequence.length;
    setTheme(sequence[nextIndex]);
  };

  const Icon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <button
      onClick={cycleTheme}
      className="rounded-md p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
      title={`Current: ${theme} (showing ${resolvedTheme})`}
    >
      <Icon className="h-5 w-5" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
