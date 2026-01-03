'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface UserProfile {
  id: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  tenantType: string | null;
  firstName: string | null;
  lastName: string | null;
}

// Helper to convert string to title case
function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    try {
      const supabase = await getSupabaseBrowser();
      const { data, error } = await supabase
        .from('User')
        .select('id, role, firstName, lastName, Tenant(tenantType)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        setProfile(null);
        return;
      }

      setProfile({
        id: data.id,
        role: data.role as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
        tenantType: (data.Tenant as any)?.tenantType || null,
        firstName: data.firstName,
        lastName: data.lastName,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Check active session
    const checkUser = async () => {
      try {
        const supabase = await getSupabaseBrowser();
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        // Set loading false immediately, fetch profile in background
        setLoading(false);
        if (currentUser) {
          // Don't await - let it load in background
          fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error checking auth session:', error);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth changes
    const setupAuthListener = async () => {
      const supabase = await getSupabaseBrowser();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setLoading(false);
        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
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
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
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
  const { user, profile, loading } = useSupabaseAuth();

  // Get tenantType from profile (database) or fallback to metadata
  const tenantType = profile?.tenantType ||
    (user?.user_metadata?.tenantType || user?.user_metadata?.userType || 'TALENT');
  const normalizedTenantType = typeof tenantType === 'string' ? tenantType.toUpperCase() : 'TALENT';

  // Get role from profile (database) - this is the proper fix
  const role = profile?.role || 'USER';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  // Build display name from firstName/lastName with title case, fallback to email prefix
  const getDisplayName = () => {
    if (profile?.firstName || profile?.lastName) {
      const first = toTitleCase(profile.firstName);
      const last = toTitleCase(profile.lastName);
      return `${first} ${last}`.trim();
    }
    // Fallback to email prefix with title case
    const emailPrefix = user?.email?.split('@')[0] || '';
    return toTitleCase(emailPrefix.replace(/[._-]/g, ' '));
  };

  return {
    data: user ? {
      user: {
        id: user.id,
        email: user.email,
        name: getDisplayName(),
        image: null,
        tenantType: normalizedTenantType,
        role: role,
        isAdmin: isAdmin,
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    } : null,
    status: loading ? 'loading' : (user ? 'authenticated' : 'unauthenticated'),
  };
}