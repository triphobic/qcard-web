'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    const checkUser = async () => {
      try {
        const supabase = await getSupabaseBrowser();
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error checking auth session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth changes
    const setupAuthListener = async () => {
      const supabase = await getSupabaseBrowser();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
      return subscription;
    };

    let subscription: any;
    setupAuthListener().then(sub => { subscription = sub; });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      const supabase = await getSupabaseBrowser();
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within an AuthProvider');
  }
  return context;
}

// Compatibility layer for NextAuth-like API
export function useSession() {
  const { user, loading } = useSupabaseAuth();

  // Get tenantType from metadata and normalize to uppercase
  const rawTenantType = user?.user_metadata?.tenantType || user?.user_metadata?.userType || 'TALENT';
  const tenantType = typeof rawTenantType === 'string' ? rawTenantType.toUpperCase() : 'TALENT';

  return {
    data: user ? {
      user: {
        id: user.id,
        email: user.email,
        name: user.email?.split('@')[0], // Use email prefix as name if not available
        image: null,
        tenantType: tenantType,
        role: user.user_metadata?.role || 'USER',
        isAdmin: user.user_metadata?.role === 'ADMIN' || user.user_metadata?.role === 'SUPER_ADMIN',
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    } : null,
    status: loading ? 'loading' : (user ? 'authenticated' : 'unauthenticated'),
  };
}