import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { syncDiscordProfileFromSession } from '@/lib/syncDiscordProfile';

function readOAuthParams() {
  const search = new URLSearchParams(window.location.search);
  const hash =
    window.location.hash && window.location.hash.length > 1
      ? new URLSearchParams(window.location.hash.slice(1))
      : null;
  const code = search.get('code') ?? hash?.get('code') ?? null;
  const state = search.get('state') ?? hash?.get('state') ?? null;
  const oauthError = search.get('error') ?? hash?.get('error') ?? null;
  const oauthErrorDesc = search.get('error_description') ?? hash?.get('error_description') ?? null;
  return { code, state, oauthError, oauthErrorDesc };
}

/** Clear OAuth params from address bar without reload (code must not be reused). */
function stripOAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  if (url.hash && url.hash.length > 1) {
    const h = new URLSearchParams(url.hash.slice(1));
    h.delete('code');
    h.delete('state');
    h.delete('error');
    h.delete('error_description');
    const rest = h.toString();
    url.hash = rest ? `#${rest}` : '';
  }
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

const DiscordCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting your Discord account...');

  useEffect(() => {
    let cancelled = false;
    let finished = false;

    const finishWithSession = async (): Promise<boolean> => {
      if (cancelled || finished) return finished;
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session?.user) return false;

      finished = true;
      await supabase.auth.refreshSession().catch(() => {});

      try {
        const syncResult = await syncDiscordProfileFromSession(session);
        if (syncResult.error) {
          console.warn('DiscordCallback profile sync:', syncResult.error.message);
        }
      } catch (e) {
        console.warn('DiscordCallback profile sync threw:', e);
      }

      stripOAuthParamsFromUrl();

      if (!cancelled) {
        setStatus('success');
        setMessage('Signed in. Redirecting…');
        window.location.replace(`${window.location.origin}/`);
      }
      return true;
    };

    void (async () => {
      const { code, state, oauthError, oauthErrorDesc } = readOAuthParams();

      if (oauthError) {
        const detail = oauthErrorDesc ? decodeURIComponent(oauthErrorDesc.replace(/\+/g, ' ')) : oauthError;
        if (!cancelled) {
          setStatus('error');
          setMessage(`Discord: ${detail}`);
        }
        stripOAuthParamsFromUrl();
        return;
      }

      if (code && state) {
        try {
          const decoded = JSON.parse(atob(state)) as { kind?: string; token?: string };
          if (decoded?.kind === 'verify' && decoded?.token) {
            const fwd = new URLSearchParams({ code, state });
            navigate(`/verify/${decoded.token}?${fwd.toString()}`, { replace: true });
            return;
          }
        } catch {
          /* Supabase PKCE sign-in */
        }
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, sess) => {
        if (cancelled || finished) return;
        if (!sess?.user) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          void finishWithSession();
        }
      });

      // Existing session (already logged in)
      if (await finishWithSession()) {
        subscription.unsubscribe();
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();
          if (retrySession?.user) {
            finished = false;
            await finishWithSession();
            subscription.unsubscribe();
            return;
          }
          if (!cancelled) {
            setStatus('error');
            setMessage(
              exchangeError.message.includes('code verifier')
                ? 'Sign-in session expired or started on a different device. Try signing in again from the Auth page.'
                : exchangeError.message || 'Could not complete Discord sign-in.',
            );
          }
          subscription.unsubscribe();
          return;
        }
        finished = false;
        await finishWithSession();
        subscription.unsubscribe();
        return;
      }

      // No code: wait for async edge cases (another tab, slow storage)
      for (let i = 0; i < 120 && !cancelled && !finished; i++) {
        if (await finishWithSession()) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      if (!finished && !cancelled) {
        setStatus('error');
        setMessage(
          'No authorization returned from Discord. Confirm redirect URL matches Supabase and Discord settings, then try again.',
        );
      }

      subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const Icon = status === 'loading' ? Loader2 : status === 'success' ? CheckCircle2 : XCircle;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-md border-border/60">
          <CardContent className="p-8 text-center">
            <Icon
              className={`mx-auto mb-4 h-12 w-12 ${
                status === 'loading' ? 'animate-spin text-primary' : status === 'success' ? 'text-success' : 'text-destructive'
              }`}
            />
            <h1 className="mb-2 text-2xl font-bold">Discord Connection</h1>
            <p className="mb-6 text-sm text-muted-foreground">{message}</p>
            {status === 'error' && (
              <Link to="/auth">
                <Button>Back to sign in</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DiscordCallback;
