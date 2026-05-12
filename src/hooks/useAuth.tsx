import {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getCanonicalSiteBaseUrl } from '@/lib/canonicalHost';
import { buildDiscordNativeSignInUrl } from '@/lib/discordOAuth';
import { toast } from 'sonner';
import {
  pullDiscordProfileAfterOAuth,
  syncDiscordProfileFromSession,
} from '@/lib/syncDiscordProfile';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function normalizeProfileRow(row: Profile): Profile {
  return {
    ...row,
    is_pro: !!row.is_pro,
    pro_badge_label: row.pro_badge_label ?? null,
    roblox_user_id: row.roblox_user_id ?? null,
    roblox_verified_at: row.roblox_verified_at ?? null,
  };
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
  is_pro: boolean;
  pro_badge_label: string | null;
  roblox_user_id: string | null;
  roblox_verified_at: string | null;
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
  /** Set when staff bans the account; client signs out if present. */
  banned_at?: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  /** Dedupe rapid double hydration (e.g. getSession + SIGNED_IN) within a few seconds. */
  const lastDiscordMediaPullRef = useRef<{ userId: string; at: number } | null>(null);

  const pullDiscordAvatarBannerAfterLogin = useCallback(async (session: Session) => {
    const uid = session.user.id;
    const now = Date.now();
    const prev = lastDiscordMediaPullRef.current;
    if (prev?.userId === uid && now - prev.at < 10_000) {
      await syncDiscordProfileFromSession(session);
      return;
    }
    lastDiscordMediaPullRef.current = { userId: uid, at: now };
    await pullDiscordProfileAfterOAuth(session);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();

    if (data) {
      const row = normalizeProfileRow(data as Profile);
      if (row.banned_at) {
        await supabase.auth.signOut();
        setProfile(null);
        toast.error('This account has been suspended.');
        return;
      }
      setProfile(row);
      return;
    }

    // Missing row (failed trigger) or not hydrated yet: create/update from Discord session — same source as OAuth callback.
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (s?.user?.id === userId) {
      const syncResult = await pullDiscordProfileAfterOAuth(s);
      if (!syncResult.error) {
        const { data: row } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
        if (row) {
          const p = normalizeProfileRow(row as Profile);
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
      // Initial hydration runs fetchProfile from getSession() below — skip duplicate work.
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_IN') {
        setTimeout(() => {
          void (async () => {
            await pullDiscordAvatarBannerAfterLogin(nextSession);
            await fetchProfile(nextSession.user.id);
          })();
        }, 0);
        return;
      }
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setTimeout(() => {
          void fetchProfile(nextSession.user.id);
        }, 0);
      }
    });

    async function consumeAuthUrlFragment(): Promise<void> {
      if (typeof window === 'undefined') return;
      const raw = window.location.hash?.slice(1) ?? '';
      if (!raw.includes('access_token=') || !raw.includes('refresh_token=')) return;
      const p = new URLSearchParams(raw);
      const access_token = p.get('access_token');
      const refresh_token = p.get('refresh_token');
      if (!access_token || !refresh_token) return;
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.warn('[auth] Supabase fragment session:', error.message);
        return;
      }
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    void (async () => {
      await consumeAuthUrlFragment();
      if (cancelled) {
        subscription.unsubscribe();
        return;
      }
      const {
        data: { session: initial },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(initial);
      setUser(initial?.user ?? null);
      // End global loading immediately so routes paint; profile loads in the background.
      setLoading(false);
      if (initial?.user) {
        void (async () => {
          await pullDiscordAvatarBannerAfterLogin(initial);
          await fetchProfile(initial.user.id);
        })();
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile, pullDiscordAvatarBannerAfterLogin]);

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

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    const sess = data.session;
    if (!uid || !sess) return;
    await pullDiscordProfileAfterOAuth(sess).catch(() => {});
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
  }, []);

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
    window.location.assign(buildDiscordNativeSignInUrl());
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signInWithDiscord,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, loading, signInWithDiscord, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
