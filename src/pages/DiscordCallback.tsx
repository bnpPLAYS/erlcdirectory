import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const { loading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting your Discord account...');

  useEffect(() => {
    if (loading) return;

    const finishWithSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setStatus('error');
        setMessage(sessionError?.message || 'No session after sign-in.');
        return;
      }
      const { error: syncError } = await syncDiscordProfileFromSession(session);
      if (syncError) {
        setStatus('error');
        setMessage(syncError.message || 'Could not update your profile.');
        return;
      }
      setStatus('success');
      setMessage('Signed in with Discord. Redirecting…');
      setTimeout(() => navigate('/', { replace: true }), 600);
    };

    const run = async () => {
      const { code, state } = readOAuthParams();

      // Experience verification: direct Discord OAuth with custom state (not Supabase login)
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

      // Supabase often exchanges the code via detectSessionInUrl before this effect runs,
      // which strips ?code= from the URL — session is already valid; do not require code.
      const { data: preSession } = await supabase.auth.getSession();
      if (preSession.session?.user) {
        await finishWithSession();
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Missing authorization code. Try signing in again.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setStatus('error');
        setMessage(exchangeError.message || 'Could not complete Discord sign-in.');
        return;
      }

      await finishWithSession();
    };

    void run();
  }, [loading, navigate]);

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
