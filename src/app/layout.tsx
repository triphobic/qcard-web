import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/navigation';
import { Providers } from './providers';

// Force dynamic rendering since we use authentication throughout the app
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'QCard - Casting Platform',
  description: 'Connect studios with talent for video and movie production',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function getCookie(name) {
                  const value = '; ' + document.cookie;
                  const parts = value.split('; ' + name + '=');
                  if (parts.length === 2) return parts.pop().split(';').shift();
                  return null;
                }

                function getSystemTheme() {
                  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }

                try {
                  // Priority 1: Check cookie
                  const cookieTheme = getCookie('theme');
                  let theme = cookieTheme || 'system';

                  // Priority 2: Account settings would be checked here (requires SSR)
                  // Priority 3: System preference
                  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

                  // Apply theme immediately to prevent flash
                  if (effectiveTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  console.error('Theme initialization error:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors">
        <Providers>
          {/* Render without AuthLoading wrapper to avoid blocking */}
          <Navigation />
          <main className="min-h-screen">{children}</main>
        </Providers>

        {/* Removed emergency button and inline scripts that cause hydration issues */}
      </body>
    </html>
  );
}