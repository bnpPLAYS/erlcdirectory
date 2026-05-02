import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, MessageSquare, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';

const Auth = () => {
  const { user, loading, signInWithDiscord } = useAuth();
  const navigate = useNavigate();

  const handleDevLogin = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('dev-login', {
        body: { appRedirectTo: window.location.origin },
      });
      if (error || !data?.actionLink) {
        console.error('Dev login failed', error, data);
        alert('Dev login failed. Check console.');
        return;
      }
      window.location.href = data.actionLink;
    } catch (e) {
      console.error(e);
      alert('Dev login error.');
    }
  };

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const features = [
    { icon: Shield, title: 'Discord-linked account', description: 'Your profile starts from your Discord account.' },
    { icon: Users, title: 'Show your experience', description: 'Add departments, staff history, skills, and availability.' },
    { icon: MessageSquare, title: 'Private messages', description: 'Talk with applicants, staff, and server owners in one place.' },
    { icon: Star, title: 'Find a better fit', description: 'Help active servers understand what you bring before they reach out.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        <Link to="/">
          <Button variant="ghost" className="gap-2 mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Left side - Benefits */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-3">Sign in to ERLC Directory</h1>
                <p className="text-muted-foreground text-lg">
                  Use Discord to create a profile, list experience, and contact ER:LC servers.
                </p>
              </div>
              
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Right side - Auth Card */}
            <Card className="border-border/50">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-2xl">E</span>
                </div>
                <CardTitle>Continue with Discord</CardTitle>
                <CardDescription>
                  Create an account or reconnect an existing profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button 
                  className="w-full gap-3 h-12 bg-discord hover:bg-discord/90 text-primary-foreground"
                  onClick={signInWithDiscord}
                  disabled={loading}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  {loading ? 'Loading...' : 'Continue with Discord'}
                </Button>
                
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    We only access your Discord username, avatar, email, and server list.
                    <br />
                    We never post on your behalf.
                  </p>
                </div>
                
                {/* TEMP: dev-only login — remove before launch */}
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={handleDevLogin}
                  disabled={loading}
                >
                  Dev login (temporary)
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <p className="text-center text-xs text-muted-foreground mt-8">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
