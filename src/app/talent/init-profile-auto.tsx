'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import Link from 'next/link';

interface AutoInitProfileProps {
  onComplete?: () => void;
}

/**
 * Automatically initializes a talent profile without requiring user interaction
 * Shows a loading screen while initializing, with proper error handling
 */
export default function AutoInitProfile({ onComplete }: AutoInitProfileProps) {
  const { data: session, status } = useSession();
  const { signOut } = useSupabaseAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const initStarted = useRef(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/sign-in');
    } catch (err) {
      console.error('Logout failed:', err);
      // Force redirect anyway
      window.location.href = '/sign-in';
    }
  };

  useEffect(() => {
    // Prevent multiple initializations
    if (initStarted.current || status !== 'authenticated' || !session?.user?.id) {
      return;
    }

    initStarted.current = true;
    setIsInitializing(true);

    async function autoInitialize() {
      const maxAttempts = 2;
      let lastError = '';

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`Profile init attempt ${attempt}/${maxAttempts}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch('/api/talent-init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            console.log("Profile initialized successfully");
            if (onComplete) {
              onComplete();
            } else {
              router.push('/talent/profile');
            }
            return;
          }

          // Handle specific error codes
          if (response.status === 404) {
            lastError = 'Backend service unavailable. Please try again later.';
          } else {
            const data = await response.json().catch(() => ({}));
            lastError = data.error || `Server error (${response.status})`;
          }

        } catch (err: any) {
          if (err.name === 'AbortError') {
            lastError = 'Request timed out. Please check your connection.';
          } else {
            lastError = err.message || 'Network error';
          }
        }

        // Wait before retry (only if not last attempt)
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // All attempts failed
      setError(lastError);
      setIsInitializing(false);
    }

    autoInitialize();
  }, [session, status, router, onComplete]);

  // Error state - show friendly error page
  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-dark-bg flex flex-col items-center justify-center z-50">
        <div className="text-center p-8 max-w-md bg-white dark:bg-dark-card rounded-lg shadow-lg">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-2">Profile Setup Failed</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>

          <div className="space-y-3">
            <button
              onClick={() => {
                initStarted.current = false;
                setError(null);
                setIsInitializing(true);
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
            >
              {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </button>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              If this problem persists, try logging out and registering again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-dark-bg flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Setting Up Your Profile</h2>
        <p className="text-gray-600 dark:text-gray-300 text-center max-w-sm">
          This will only take a moment...
        </p>
      </div>
    </div>
  );
}
