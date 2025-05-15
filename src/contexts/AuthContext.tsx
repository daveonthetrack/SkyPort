import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  name: string;
  phone_number: string;
  role: 'sender' | 'traveler';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  trust_level: number;
  completed_deliveries: number;
  is_phone_verified: boolean;
  is_email_verified: boolean;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
};

type AuthContextType = AuthState & {
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INITIAL_STATE: AuthState = {
  session: null,
  user: null,
  profile: null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile implementation
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Auth] Profile fetch error:', error.message);
        throw error;
      }

      if (!data) {
        console.warn('[Auth] No profile found for user:', userId);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('[Auth] Unexpected error in fetchProfile:', error);
      throw error;
    }
  }, []);

  // Update auth state with session
  const updateAuthState = useCallback(async (session: Session | null) => {
    try {
      if (!session?.user) {
        setState(INITIAL_STATE);
        return;
      }

      // Update session and user immediately
      setState(prev => ({
        ...prev,
        session,
        user: session.user,
      }));

      // Then fetch and update profile
      const profile = await fetchProfile(session.user.id);
      setState(prev => ({ ...prev, profile }));
    } catch (error) {
      console.error('[Auth] Error updating auth state:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  }, [fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          await updateAuthState(session);
        }
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to initialize authentication');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        await updateAuthState(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [updateAuthState]);

  // Sign in implementation
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      const authError = error as AuthError;
      console.error('[Auth] Sign in error:', authError);
      throw new Error(authError.message);
    } finally {
      setLoading(false);
    }
  };

  // Sign up implementation
  const signUp = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    } catch (error) {
      const authError = error as AuthError;
      console.error('[Auth] Sign up error:', authError);
      throw new Error(authError.message);
    } finally {
      setLoading(false);
    }
  };

  // Sign out implementation
  const signOut = async () => {
    try {
      setError(null);
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setState(INITIAL_STATE);
    } catch (error) {
      const authError = error as AuthError;
      console.error('[Auth] Sign out error:', authError);
      throw new Error(authError.message);
    } finally {
      setLoading(false);
    }
  };

  // Manual profile refresh
  const refreshProfile = async () => {
    if (!state.user?.id) {
      console.warn('[Auth] Cannot refresh profile: No user ID available');
      return;
    }

    try {
      setLoading(true);
      const profile = await fetchProfile(state.user.id);
      setState(prev => ({ ...prev, profile }));
    } catch (error) {
      console.error('[Auth] Profile refresh error:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh profile');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    ...state,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 