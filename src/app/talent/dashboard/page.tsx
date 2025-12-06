'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSession, useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useRouter } from 'next/navigation';
import SuggestedRoles from '@/components/talent/SuggestedRoles';

export default function TalentDashboard() {
  const { data: session, status } = useSession();
  const { signOut } = useSupabaseAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchAttempted = useRef(false);

  useEffect(() => {
    // Only fetch once per mount
    if (fetchAttempted.current || status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/sign-in');
      return;
    }

    if (!session?.user?.id) {
      setError("Session data is missing. Please sign in again.");
      setIsLoading(false);
      return;
    }

    if (session?.user?.tenantType !== 'TALENT') {
      router.push('/studio/dashboard');
      return;
    }

    fetchAttempted.current = true;

    async function fetchOrCreateProfile() {
      try {
        // Try to fetch existing profile
        let response = await fetch('/api/talent/profile', {
          headers: { 'Cache-Control': 'no-cache' }
        });

        // If profile doesn't exist, create it silently
        if (response.status === 404) {
          const initResponse = await fetch('/api/profile-init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userType: 'TALENT' })
          });

          if (!initResponse.ok) {
            console.error('Profile init failed:', await initResponse.text());
            // Continue anyway - profile page can handle missing profile
          }

          // Retry fetching profile after init
          response = await fetch('/api/talent/profile', {
            headers: { 'Cache-Control': 'no-cache' }
          });
        }

        if (response.ok) {
          const data = await response.json();
          setProfileData(data);
        }
        // If still 404 or error, just show dashboard without profile data
        // The profile page can handle the actual profile setup
      } catch (err) {
        console.error('Error loading profile:', err);
        // Don't show error - just proceed without profile data
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrCreateProfile();
  }, [status, session, router]);

  const handleLogout = async () => {
    await signOut();
    router.push('/sign-in');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center p-8 max-w-md bg-white dark:bg-dark-card rounded-lg shadow-lg">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Unable to Load Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Talent Dashboard</h1>

      <div className="bg-white dark:bg-dark-card shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Welcome, {session?.user?.name || 'Talent'}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your profile, applications, and projects from this dashboard.
        </p>
      </div>

      <div className="bg-white dark:bg-dark-card shadow rounded-lg p-6 mb-6">
        <SuggestedRoles />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Your Profile</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Update your profile and preferences
          </p>
          <Link href="/talent/profile" className="text-blue-600 hover:text-blue-800">
            Edit Profile →
          </Link>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Casting Opportunities</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Browse available casting calls
          </p>
          <Link href="/opportunities" className="text-green-600 hover:text-green-800">
            View Opportunities →
          </Link>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Your Applications</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Check the status of your applications
          </p>
          <Link href="/talent/applications" className="text-purple-600 hover:text-purple-800">
            View Applications →
          </Link>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Projects</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            View projects you&apos;re involved in
          </p>
          <Link href="/talent/projects" className="text-orange-600 hover:text-orange-800">
            View Projects →
          </Link>
        </div>

        <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Messages</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Communicate with studios and casting directors
          </p>
          <Link href="/talent/messages" className="text-teal-600 hover:text-teal-800">
            View Messages →
          </Link>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Calendar</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Manage your availability and bookings
          </p>
          <Link href="/talent/calendar" className="text-red-600 hover:text-red-800">
            View Calendar →
          </Link>
        </div>
      </div>
    </div>
  );
}
