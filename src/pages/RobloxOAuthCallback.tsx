import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { invokeRobloxOAuthComplete } from '@/lib/callRobloxProfileOAuth';
import { ROBLOX_OAUTH_RETURN_PATH_KEY } from '@/lib/robloxOAuthSession';
import { toast } from 'sonner';

/** Avoid duplicate token exchange in React Strict Mode (dev) remounts. */
let lastRobloxOAuthStateHandled: string | null = null;

/**
 * Roblox OAuth redirect target (must match ROBLOX_OAUTH_REDIRECT_URI in Supabase secrets exactly).
 */
export default function RobloxOAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, refreshProfile } = useAuth();
  const [message, setMessage] = useState('Finishing Roblox sign-in…');

  useEffect(() => {
    if (loading) return;

    if (!user) {
      toast.error('Sign in to the directory first, then link Roblox from your profile.');
      navigate('/auth', { replace: true });
      return;
    }

    const err = searchParams.get('error');
    const errDesc = searchParams.get('error_description');
    if (err) {
      let decoded = errDesc?.replace(/\+/g, ' ') ?? '';
      if (decoded) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch {
          /* keep raw */
        }
      }
      const human =
        err === 'access_denied' ? 'Roblox sign-in was cancelled.' : decoded || 'Roblox sign-in did not complete.';
      toast.error(human);
      const ret = sessionStorage.getItem(ROBLOX_OAUTH_RETURN_PATH_KEY);
      sessionStorage.removeItem(ROBLOX_OAUTH_RETURN_PATH_KEY);
      navigate(ret || '/browse', { replace: true });
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      toast.error('Missing Roblox sign-in parameters.');
      const ret = sessionStorage.getItem(ROBLOX_OAUTH_RETURN_PATH_KEY);
      sessionStorage.removeItem(ROBLOX_OAUTH_RETURN_PATH_KEY);
      navigate(ret || '/browse', { replace: true });
      return;
    }

    if (lastRobloxOAuthStateHandled === state) return;
    lastRobloxOAuthStateHandled = state;

    void (async () => {
      const r = await invokeRobloxOAuthComplete({ code, state });
      if (!r.ok) {
        setMessage('');
        toast.error(r.error);
        const ret = sessionStorage.getItem(ROBLOX_OAUTH_RETURN_PATH_KEY);
        sessionStorage.removeItem(ROBLOX_OAUTH_RETURN_PATH_KEY);
        navigate(ret || '/browse', { replace: true });
        return;
      }
      await refreshProfile();
      toast.success('Roblox profile linked.');
      const ret = sessionStorage.getItem(ROBLOX_OAUTH_RETURN_PATH_KEY) || '';
      sessionStorage.removeItem(ROBLOX_OAUTH_RETURN_PATH_KEY);
      const url = ret ? `${ret}${ret.includes('?') ? '&' : '?'}roblox_linked=1` : '/browse';
      navigate(url, { replace: true });
    })();
  }, [loading, navigate, refreshProfile, searchParams, user]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
