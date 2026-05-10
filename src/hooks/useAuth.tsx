import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getCanonicalSiteBaseUrl } from '@/lib/canonicalHost';
import { getDiscordRedirectUri } from '@/lib/discordOAuth';
import { toast } from 'sonner';
import { syncDiscordProfileFromSession } from '@/lib/syncDiscordProfile';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface Profile {
  id: string;
  user_id: string;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  timezone: string | null;
  is_verified: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  skills: string[];
  social_links: Record<string, string>;
  banner_url: string | null;
  accent_color: string | null;
  pronouns: string | null;
  status: string | null;
  availability: string | null;
  website: string | null;
  theme_preset: string | null;
  /** Absent or ISO timestamp = OK; explicit `null` from DB = must accept in-app. */
  terms_accepted_at?: string | null;
  dm_website_updates?: boolean | null;
  dm_experience_status_updates?: boolean | null;
  created_at: string;
  updated_at: string;
  banned_at?: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();

    if (data) {
      const row = data as Profile;
      if (row.banned_at) {
        await supabase.auth.signOut();
        setProfile(null);
        toast.error('This account has been suspended.');
        return;
      }
      setProfile(row);
      return;
    }

    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (s?.user?.id === userId) {
      const syncResult = await syncDiscordProfileFromSession(s);
      if (!syncResult.error) {
        const { data: row } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
        if (row) {
          const p = row as Profile;
          if (p.banned_at) {
            await supabase.auth.signOut();
            setProfile(null);
            toast.error('This account has been suspended.');
            return;
          }
          setProfile(p);
        }
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        setProfile(null);
        return;
      }
      // Initial load awaits `profiles` in getSession() below so `loading` stays true until the first row hydrates.
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setTimeout(() => {
          void fetchProfile(nextSession.user.id);
        }, 0);
      }
    });

    void supabase.auth.getSession().then(async ({ data: { session: initial } }) => {
      if (cancelled) return;
      setSession(initial);
      setUser(initial?.user ?? null);
      if (initial?.user) {
        await fetchProfile(initial.user.id);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  useEffect(() => {
    const refresh = () => {
      void supabase.auth.getSession();
      void supabase.auth.refreshSession().catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    const session = data.session;
    if (!uid || !session) return;
    await syncDiscordProfileFromSession(session).catch(() => {});
    const row = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
    if (!row.error && row.data) {
      const p = row.data as Profile;
      if (p.banned_at) {
        await supabase.auth.signOut();
        setProfile(null);
        toast.error('This account has been suspended.');
        return;
      }
      setProfile(p);
    }
  };

  const signInWithDiscord = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const here = window.location.origin.replace(/\/+$/, '');
      const canonical = getCanonicalSiteBaseUrl();
      if (here !== canonical) {
        const next = encodeURIComponent(
          `${window.location.pathname}${window.location.search}${window.location.hash}`,
        );
        window.location.assign(`${canonical}/auth?oauth=discord&next=${next}`);
        return;
      }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: getDiscordRedirectUri(),
        scopes: 'identify email guilds',
      },
    });
    if (error) {
      console.error(error);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signInWithDiscord, signOut, refreshProfile }}>
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
