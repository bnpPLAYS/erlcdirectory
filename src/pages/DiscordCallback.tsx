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
  return { code, state };
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

      const { error: syncError } = await syncDiscordProfileFromSession(session);
      if (syncError) {
        finished = false;
        setStatus('error');
        setMessage(syncError.message || 'Could not update your profile.');
        return false;
      }
      setStatus('success');
      setMessage('Signed in with Discord. Redirecting…');
      setTimeout(() => navigate('/', { replace: true }), 500);
      return true;
    };

    void (async () => {
      const { code, state } = readOAuthParams();

      if (code && state) {
        try {
          const decoded = JSON.parse(atob(state)) as { kind?: string; token?: string };
          if (decoded?.kind === 'verify' && decoded?.token) {
            const fwd = new URLSearchParams({ code, state });
            navigate(`/verify/${decoded.token}?${fwd.toString()}`, { replace: true });
            return;
          }
        } catch {
          /* Supabase PKCE state — not verify */
        }
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled || finished) return;
        if (!session?.user) return;
        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION'
        ) {
          void finishWithSession();
        }
      });

      for (let i = 0; i < 80 && !cancelled && !finished; i++) {
        await finishWithSession();
        if (finished) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      if (!finished && !cancelled && code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus('error');
          setMessage(exchangeError.message || 'Could not complete Discord sign-in.');
          subscription.unsubscribe();
          return;
        }
        await finishWithSession();
      }

      if (!finished && !cancelled) {
        setStatus('error');
        setMessage(
          code
            ? 'Could not establish a session. Try signing in again from the Auth page.'
            : 'Missing authorization code. Try signing in again.',
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
