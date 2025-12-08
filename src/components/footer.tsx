'use client';

import { ThemeToggle } from '@/components/theme-toggle';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-dark-bg border-t border-gray-200 dark:border-gray-700 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} QCard. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
