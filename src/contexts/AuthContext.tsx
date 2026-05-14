import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
// @ts-ignore
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
// @ts-ignore
import type { Profile } from '@/types/types';
import { toast } from 'sonner';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
  return data;
}

interface Subscription {
  tier: 'freelancer' | 'agency';
  status: 'active' | 'inactive' | 'cancelled' | 'trialing';
  billing_cycle?: 'monthly' | 'yearly';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  loading: boolean;
  isAgency: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const isAgency = subscription?.tier === 'agency' && subscription?.status === 'active';

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileData = await getProfile(user.id);
    setProfile(profileData);
  };

  const refreshSubscription = async () => {
    if (!user) {
      setSubscription(null);
      return;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('tier, status, billing_cycle')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch subscription:', error);
      return;
    }

    setSubscription(data);
  };

  useEffect(() => {
    supabase
      .auth
      .getSession()
      // @ts-ignore
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          getProfile(session.user.id).then(setProfile);
          // Fetch subscription
          supabase
            .from('subscriptions')
            .select('tier, status, billing_cycle')
            .eq('user_id', session.user.id)
            .maybeSingle()
            .then(({ data }) => setSubscription(data));
        }
      })
      // @ts-ignore
      .catch(error => {
        toast.error(`获取用户信息失败: ${error.message}`);
      })
      .finally(() => {
        setLoading(false);
      });

    // @ts-ignore
    // In this function, do NOT use any await calls. Use `.then()` instead to avoid deadlocks.
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getProfile(session.user.id).then(setProfile);
        // Fetch subscription
        supabase
          .from('subscriptions')
          .select('tier, status, billing_cycle')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => setSubscription(data));
      } else {
        setProfile(null);
        setSubscription(null);
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Send welcome email
      if (data.user) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'welcome',
              to: email,
              data: {
                username,
              },
            },
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail signup if email fails
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSubscription(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, subscription, loading, isAgency, signInWithUsername, signUpWithUsername, signOut, refreshProfile, refreshSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
