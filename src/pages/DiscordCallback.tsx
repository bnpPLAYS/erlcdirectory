import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { syncDiscordProfileFromSession } from '@/lib/syncDiscordProfile';

const DiscordCallback = () => {
  const navigate = useNavigate();
  const { loading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting your Discord account...');

  useEffect(() => {
    if (loading) return;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

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
          /* Supabase PKCE state is not our verify payload — continue to login flow */
        }
      }

      if (!code) {
        setStatus('error');
        setMessage('Missing authorization code. Try signing in again.');
        return;
      }

      let {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!session) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus('error');
          setMessage(exchangeError.message || 'Could not complete Discord sign-in.');
          return;
        }
        ({
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession());
      }

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
