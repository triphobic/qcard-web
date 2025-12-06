'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSupabaseAuth';

export default function StudioDashboard() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [studioData, setStudioData] = useState(null);
  const fetchAttempted = useRef(false);

  useEffect(() => {
    // Only fetch once per mount
    if (fetchAttempted.current || status === 'loading') return;

    if (status === 'unauthenticated') {
      window.location.href = '/sign-in';
      return;
    }

    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    if (session?.user?.tenantType !== 'STUDIO') {
      window.location.href = '/talent/dashboard';
      return;
    }

    fetchAttempted.current = true;

    async function fetchOrCreateStudio() {
      try {
        // Try to fetch existing studio profile
        let response = await fetch('/api/studio/profile', {
          headers: { 'Cache-Control': 'no-cache' }
        });

        // If studio doesn't exist, create it silently
        if (response.status === 404) {
          const initResponse = await fetch('/api/profile-init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userType: 'STUDIO' })
          });

          if (!initResponse.ok) {
            console.error('Studio init failed:', await initResponse.text());
          }

          // Retry fetching studio after init
          response = await fetch('/api/studio/profile', {
            headers: { 'Cache-Control': 'no-cache' }
          });
        }

        if (response.ok) {
          const data = await response.json();
          setStudioData(data);
        }
      } catch (error) {
        console.error('Error loading studio:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrCreateStudio();
  }, [status, session?.user?.id, session?.user?.tenantType]);

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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Studio Dashboard</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Welcome, {session?.user?.name || 'Studio'}
        </h2>
        <p className="text-gray-600">
          Manage your casting calls, projects, and talent from this dashboard.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className="bg-blue-50 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Casting Calls</h3>
          <p className="text-gray-600 mb-3">
            Create and manage casting calls to find talent
          </p>
          <Link 
            href="/studio/casting-calls" 
            className="text-blue-600 hover:text-blue-800"
          >
            Manage Casting Calls →
          </Link>
        </div>
        
        <div className="bg-green-50 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Projects</h3>
          <p className="text-gray-600 mb-3">
            Manage your current and upcoming projects
          </p>
          <Link 
            href="/studio/projects" 
            className="text-green-600 hover:text-green-800"
          >
            View Projects →
          </Link>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Talent Search</h3>
          <p className="text-gray-600 mb-3">
            Find talent for your projects and casting calls
          </p>
          <Link 
            href="/studio/talent-search" 
            className="text-purple-600 hover:text-purple-800"
          >
            Search Talent →
          </Link>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Applications</h3>
          <p className="text-gray-600 mb-3">
            Review applications to your casting calls
          </p>
          <Link 
            href="/studio/applications" 
            className="text-orange-600 hover:text-orange-800"
          >
            Review Applications →
          </Link>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">External Talent</h3>
          <p className="text-gray-600 mb-3">
            Upload and manage external talent not on Q-Card
          </p>
          <Link 
            href="/studio/external-actors" 
            className="text-yellow-600 hover:text-yellow-800"
          >
            Manage External Talent →
          </Link>
        </div>
        
        <div className="bg-teal-50 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Messages</h3>
          <p className="text-gray-600 mb-3">
            Communicate with talent and team members
          </p>
          <Link 
            href="/studio/messages" 
            className="text-teal-600 hover:text-teal-800"
          >
            View Messages →
          </Link>
        </div>
        
        <div className="bg-red-50 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Studio Profile</h3>
          <p className="text-gray-600 mb-3">
            Update your studio information and settings
          </p>
          <Link
            href="/studio/profile"
            className="text-red-600 hover:text-red-800"
          >
            Edit Profile →
          </Link>
        </div>

        <div className="bg-indigo-50 p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-2">Casting Codes</h3>
          <p className="text-gray-600 mb-3">
            Create and manage QR casting codes for quick talent submissions
          </p>
          <Link
            href="/studio/casting-codes"
            className="text-indigo-600 hover:text-indigo-800"
          >
            Manage Casting Codes →
          </Link>
        </div>
      </div>
    </div>
  );
}