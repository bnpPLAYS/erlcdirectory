import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ExternalLink,
  Check,
  Shield,
  Palette,
  TrendingUp,
  BadgeCheck,
  Users,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { invokeVerifyRobloxPro } from '@/lib/callVerifyRobloxPro';
import { ERLC_PRO_PRICE_ROBUX, ERLC_PRO_ROBLOX_URL } from '@/lib/robloxPro';
import { cn } from '@/lib/utils';
import { pageHeroEnter } from '@/lib/pageHero';

const perks = [
  {
    icon: Palette,
    title: 'Extra accent themes',
    body: 'Unlock four Pro-only palettes (Aurora, Crimson, Midnight, Neon lime). Everyone can use the rest of Customize — preview, theme tuning, banner upload, URL paste, and Discord sync.',
  },
  {
    icon: TrendingUp,
    title: 'Directory boost',
    body: 'Pro members sort higher in the Member Directory after staff-featured profiles (same filters and sort modes apply).',
  },
  {
    icon: BadgeCheck,
    title: 'Pro badge + custom label',
    body: 'Show an ERLC Pro badge on your profile and set a short custom tagline next to it.',
  },
  {
    icon: Users,
    title: 'Stronger presence in browse',
    body: 'Your card stands out with Pro styling and better default ordering so more visitors see you first.',
  },
  {
    icon: Shield,
    title: 'Supports the directory',
    body: 'One-time Robux purchase helps keep moderation and hosting sustainable.',
  },
];

const Pro = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [robloxUsername, setRobloxUsername] = useState('');
  const [busy, setBusy] = useState(false);

  const onVerify = async () => {
    setBusy(true);
    try {
      const r = await invokeVerifyRobloxPro({ roblox_username: robloxUsername.trim() });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Pro unlocked! Your profile has been updated.');
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <header className={cn('text-center mb-12', pageHeroEnter)}>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-200 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-white/90" aria-hidden />
              {ERLC_PRO_PRICE_ROBUX} Robux · one-time
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">ERLC Directory Pro</h1>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Upgrade on Roblox, then link your Roblox account here. We verify ownership automatically with Roblox Open
              Cloud — no manual codes.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 rounded-xl border border-white/18 bg-white/[0.12] text-white hover:bg-white/[0.18] shadow-lg shadow-white/10"
              >
                <a href={ERLC_PRO_ROBLOX_URL} target="_blank" rel="noopener noreferrer">
                  Buy on Roblox <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              {user ? (
                <Button asChild variant="secondary" size="lg" className="rounded-xl">
                  <Link to={profile ? `/${profile.discord_username?.replace(/\.+$/u, '') || 'me'}?edit=1&tab=customize` : '/browse'}>
                    Edit profile
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="secondary" size="lg" className="rounded-xl">
                  <Link to="/auth">Sign in to verify</Link>
                </Button>
              )}
            </div>
          </header>

          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            {perks.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="border-white/10 bg-white/[0.02]">
                <CardContent className="p-5 flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-zinc-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">{title}</h2>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {user ? (
            <Card className="border-white/15 bg-gradient-to-b from-white/[0.06] to-transparent mb-10">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Check className="h-5 w-5 text-white/90" />
                  Verify your purchase
                </h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Use the <strong className="text-foreground">exact Roblox username</strong> that bought the pass. If
                  verification fails, open Roblox → Settings → Privacy and set “Who can see my inventory?” to{' '}
                  <strong className="text-foreground">Everyone</strong>.
                </p>
                {profile?.is_pro ? (
                  <p className="mt-4 text-sm font-medium text-zinc-200">
                    You already have Pro. Manage your badge, themes, and perks in{' '}
                    <strong className="text-foreground">Edit profile → Customize</strong>.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col sm:flex-row gap-3 max-w-lg">
                    <Input
                      placeholder="Roblox username"
                      value={robloxUsername}
                      onChange={(e) => setRobloxUsername(e.target.value)}
                      className="h-11 rounded-xl border-white/12 bg-black/30"
                    />
                    <Button
                      type="button"
                      className="h-11 rounded-xl shrink-0"
                      disabled={busy || robloxUsername.trim().length < 3}
                      onClick={() => void onVerify()}
                    >
                      {busy ? 'Checking…' : 'Verify with Roblox'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Pro;
