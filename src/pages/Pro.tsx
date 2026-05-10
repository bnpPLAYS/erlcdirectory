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
  ChevronDown,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { invokeVerifyRobloxPro } from '@/lib/callVerifyRobloxPro';
import {
  ERLC_PRO_GAME_PASS_ID,
  ERLC_PRO_PRICE_ROBUX,
  ERLC_PRO_ROBLOX_URL,
} from '@/lib/robloxPro';
import { cn } from '@/lib/utils';
import { pageHeroEnter } from '@/lib/pageHero';

const perks = [
  {
    icon: Palette,
    title: 'Extra customization',
    body: 'Unlock additional accent palettes and fine-tuned profile styling in Edit profile.',
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
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200 mb-4">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {ERLC_PRO_PRICE_ROBUX} Robux · one-time
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">ERLC Directory Pro</h1>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Upgrade on Roblox, then link your Roblox account here. We verify ownership automatically with Roblox Open
              Cloud — no manual codes.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-500">
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
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
            <Card className="border-violet-500/25 bg-gradient-to-b from-violet-950/20 to-transparent mb-10">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-400" />
                  Verify your purchase
                </h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Use the <strong className="text-foreground">exact Roblox username</strong> that bought the pass. If
                  verification fails, set Roblox privacy so inventory is visible (see setup below).
                </p>
                {profile?.is_pro ? (
                  <p className="mt-4 text-sm font-medium text-emerald-400">
                    You already have Pro on this account. Custom badge and extra themes are under Edit profile.
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

          <Collapsible className="rounded-xl border border-white/10 bg-black/20">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-white/[0.04] rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 data-[state=open]:[&_.pro-chevron]:rotate-180">
              <span>Exactly what to set up (site owner)</span>
              <ChevronDown className="pro-chevron h-4 w-4 shrink-0 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 pt-0 text-sm text-muted-foreground space-y-3 leading-relaxed border-t border-white/10">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    In{' '}
                    <a
                      href="https://create.roblox.com/dashboard/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:underline"
                    >
                      Roblox Creator Dashboard → Credentials
                    </a>
                    , create an <strong className="text-foreground">Open Cloud API Key</strong> with permission to read{' '}
                    <strong className="text-foreground">user inventory</strong> (inventory item read / game pass filters).
                  </li>
                  <li>
                    Add to Vercel (or your host):{' '}
                    <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">ROBLOX_OPEN_CLOUD_API_KEY</code> = that
                    key. Optional:{' '}
                    <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">ROBLOX_PRO_GAME_PASS_ID</code> ={' '}
                    <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">{ERLC_PRO_GAME_PASS_ID}</code> if you
                    change the pass.
                  </li>
                  <li>
                    Ensure Supabase already has{' '}
                    <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code> and URL
                    keys — the verify route uses the service role to set{' '}
                    <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">is_pro</code> after Roblox confirms
                    ownership.
                  </li>
                  <li>
                    Run the SQL migration that adds <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">is_pro</code>
                    , <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">roblox_user_id</code>, etc.
                  </li>
                </ol>
                <p>
                  <strong className="text-foreground">Players:</strong> Roblox → Settings → Privacy → “Who can see my
                  inventory?” → <strong className="text-foreground">Everyone</strong>. Otherwise Open Cloud may return 403
                  and verification cannot complete.
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Game pass id in use: {ERLC_PRO_GAME_PASS_ID}. Docs:{' '}
                  <a
                    href="https://create.roblox.com/docs/cloud/guides/inventory"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:underline"
                  >
                    Roblox Inventory API
                  </a>
                  .
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Pro;
