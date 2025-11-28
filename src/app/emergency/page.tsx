'use client';

import Link from 'next/link';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export default function EmergencyPage() {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif'
    }}>
      <div style={{
        backgroundColor: '#f44336',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '4px',
        marginBottom: '20px'
      }}>
        <h1>QCard Emergency Access</h1>
        <p>This page provides emergency functions to recover from authentication issues</p>
      </div>

      <div style={{
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2>1. Reset All Cookies</h2>
        <p>This will clear all authentication cookies and local storage.</p>
        <button
          onClick={() => {
            // Clear all cookies
            document.cookie.split(";").forEach(c => {
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            // Clear localStorage
            localStorage.clear();

            alert("All cookies and localStorage cleared!");
          }}
          style={{
            backgroundColor: '#4CAF50',
            border: 'none',
            color: 'white',
            padding: '10px 20px',
            textAlign: 'center',
            textDecoration: 'none',
            fontSize: '16px',
            margin: '4px 2px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          Clear All Cookies
        </button>
      </div>

      <div style={{
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2>2. Access Sign-In Page</h2>
        <p>Go directly to the sign-in page:</p>
        <Link
          href="/sign-in"
          style={{
            backgroundColor: '#4CAF50',
            border: 'none',
            color: 'white',
            padding: '10px 20px',
            textAlign: 'center',
            textDecoration: 'none',
            display: 'inline-block',
            fontSize: '16px',
            margin: '4px 2px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          Go to Sign-In
        </Link>
      </div>

      <div style={{
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2>3. Supabase Connection Instructions</h2>
        <p>To connect to your Supabase database:</p>
        <pre style={{
          backgroundColor: '#f1f1f1',
          padding: '10px',
          borderRadius: '4px',
          overflowX: 'auto'
        }}>
{`# Set your Supabase credentials
export SUPABASE_URL="your-project-url"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"`}
        </pre>
      </div>

      <div style={{
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2>4. Manual Navigation</h2>
        <p>Try these links:</p>
        <ul>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/sign-in">Sign In</Link></li>
          <li><Link href="/sign-up">Sign Up</Link></li>
          <li><Link href="/auth-debug">Auth Debug</Link></li>
        </ul>
      </div>
    </div>
  );
}