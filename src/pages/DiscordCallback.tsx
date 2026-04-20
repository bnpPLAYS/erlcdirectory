import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const DiscordCallback = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting your Discord account...');

  useEffect(() => {
    if (loading) return;

    const connectDiscord = async () => {
      if (!user) {
        setStatus('error');
        setMessage('Sign in first, then connect Discord from your profile.');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const expectedState = window.localStorage.getItem('discord_oauth_state');

      if (!code || !state || state !== expectedState) {
        setStatus('error');
        setMessage('Discord did not return a valid connection request. Try again.');
        return;
      }

      const { error } = await supabase.functions.invoke('discord-oauth', {
        body: {
          code,
          redirectUri: `${window.location.origin}/discord/callback`,
        },
      });

      window.localStorage.removeItem('discord_oauth_state');

      if (error) {
        setStatus('error');
        setMessage(error.message || 'Discord could not be connected.');
        return;
      }

      setStatus('success');
      setMessage('Discord is connected to your account.');
      setTimeout(() => navigate('/'), 1200);
    };

    connectDiscord();
  }, [loading, navigate, user]);

  const Icon = status === 'loading' ? Loader2 : status === 'success' ? CheckCircle2 : XCircle;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-md border-border/60">
          <CardContent className="p-8 text-center">
            <Icon className={`mx-auto mb-4 h-12 w-12 ${status === 'loading' ? 'animate-spin text-primary' : status === 'success' ? 'text-success' : 'text-destructive'}`} />
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
