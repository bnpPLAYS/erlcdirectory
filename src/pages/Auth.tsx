import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Shield, MessageSquare, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import { pageHeroEnter } from '@/lib/pageHero';

const Auth = () => {
  const { user, loading, signInWithDiscord } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const oauthKickoff = useRef(false);

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  /** After redirect from non-canonical host, continue Discord OAuth on the canonical domain. */
  useEffect(() => {
    if (searchParams.get('oauth') !== 'discord') return;
    if (loading) return;
    if (user) {
      const p = new URLSearchParams(searchParams);
      p.delete('oauth');
      p.delete('next');
      setSearchParams(p, { replace: true });
      return;
    }
    if (oauthKickoff.current) return;
    oauthKickoff.current = true;
    const p = new URLSearchParams(searchParams);
    p.delete('oauth');
    p.delete('next');
    setSearchParams(p, { replace: true });
    void signInWithDiscord();
  }, [user, loading, searchParams, setSearchParams, signInWithDiscord]);

  const features = [
    { icon: Shield, title: 'Discord-linked account', description: 'Your profile starts from your Discord identity — no extra passwords.' },
    { icon: Users, title: 'Showcase your experience', description: 'List departments, staff history, skills, and current availability.' },
    { icon: MessageSquare, title: 'Direct messaging', description: 'Talk with applicants, staff, and server owners in one place.' },
    { icon: Star, title: 'Get found by the right servers', description: 'Help active communities understand what you bring before they reach out.' },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 500px at 15% 10%, hsl(235 90% 65% / 0.18), transparent 60%), radial-gradient(700px 420px at 85% 90%, hsl(280 80% 60% / 0.12), transparent 60%)',
        }}
      />
      <Navbar />

      <div className="relative container mx-auto px-4 pt-6 pb-16">
        <Link to="/">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        </Link>

        <div className="max-w-2xl mx-auto">
          <div className="card-elevated liquid-edge rounded-3xl border border-white/10 bg-background/60 backdrop-blur-xl p-8 sm:p-12">
            <div className={`flex flex-col items-center text-center ${pageHeroEnter}`}>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg ring-1 ring-white/10">
                <span className="text-primary-foreground font-bold text-3xl">E</span>
              </div>

              <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight">
                Create your account
              </h1>
              <p className="mt-3 text-muted-foreground max-w-md">
                Join the ER:LC directory. Sign in with Discord to set up your profile, list experience, and connect with active communities.
              </p>

              <Button
                type="button"
                className="mt-8 w-full max-w-md gap-3 h-14 text-base bg-discord hover:bg-discord/90 text-primary-foreground rounded-xl shadow-lg"
                onClick={() => void signInWithDiscord()}
                disabled={loading}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                {loading ? 'Loading…' : 'Create account'}
              </Button>

              <p className="mt-3 text-xs text-muted-foreground">
                Already have a profile? Signing in with Discord will reconnect it automatically.
              </p>

              <div className="mt-10 grid sm:grid-cols-2 gap-5 text-left w-full">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{feature.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 w-full">
                <p className="text-xs text-muted-foreground">
                  We only access your Discord username, avatar, and server list. We never post on your behalf.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Auth;
