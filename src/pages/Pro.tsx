import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, RefreshCw, ExternalLink } from 'lucide-react';
import { RobloxIcon } from '@/components/icons/RobloxIcon';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { invokeVerifyRobloxPro } from '@/lib/callVerifyRobloxPro';
import { ERLC_PRO_PRICE_ROBUX, ERLC_PRO_ROBLOX_URL } from '@/lib/robloxPro';
import { RobloxLinkedPreview } from '@/components/profile/RobloxLinkedPreview';
import { profileEditorPath } from '@/lib/profilePath';

const PRO_FEATURES = [
  'Pro badge and custom label on your profile',
  'Extra accent themes and full customize controls',
  'Stronger visibility in the Member Directory',
  'Helps keep moderation and hosting sustainable',
];

const Pro = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const linked = !!profile?.roblox_user_id;
  const canVerify = !busy && linked;

  const onVerify = async () => {
    if (!linked) {
      toast.error('Link your Roblox account in Edit profile (Roblox authorization) before verifying Pro.');
      return;
    }

    setBusy(true);
    try {
      const r = await invokeVerifyRobloxPro();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Pro unlocked. Your profile is updated.');
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center px-4 py-14 sm:py-20">
        <div className="w-full max-w-md text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Simple pricing for Pro</h1>
          <p className="mt-3 text-sm sm:text-base text-zinc-500 leading-relaxed">
            Pay on Roblox, then tap <span className="text-zinc-300">Verify purchase</span> here. We check your game pass
            on the Roblox account you linked — no typed usernames.
          </p>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-6 sm:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          {user && profile && linked ? (
            <div className="rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 mb-6 flex items-center gap-3">
              <RobloxLinkedPreview robloxUserId={String(profile.roblox_user_id)} variant="compact" />
              <span className="text-xs font-medium text-emerald-400 shrink-0">Linked</span>
            </div>
          ) : user ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 mb-6 text-left">
              <p className="text-xs text-amber-100/90 leading-relaxed">
                <Link
                  to={profile ? profileEditorPath(profile, { tab: 'customize' }) : '/browse'}
                  className="underline underline-offset-2 font-medium text-white"
                >
                  Link Roblox
                </Link>{' '}
                in Edit profile (authorization) before you can verify Pro. This keeps the pass tied to the right account.
              </p>
            </div>
          ) : null}

          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 mb-2">ERLC Directory Pro</p>
          <h2 className="text-lg font-semibold text-white mb-5">Directory Pro access</h2>

          <div className="flex items-end justify-center gap-3 mb-2">
            <RobloxIcon className="h-9 w-9 shrink-0 text-amber-400/95" aria-hidden />
            <span className="text-4xl sm:text-5xl font-bold tabular-nums text-white tracking-tight">{ERLC_PRO_PRICE_ROBUX}</span>
            <span className="text-sm text-zinc-500 pb-1.5">Robux</span>
          </div>
          <p className="text-xs text-zinc-500 text-center mb-8">Game pass on Roblox · unlocks Pro on this site after verification</p>

          <ul className="space-y-3 mb-8 text-left">
            {PRO_FEATURES.map((line) => (
              <li key={line} className="flex gap-3 text-sm text-zinc-400">
                <Check className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {user ? (
            profile?.is_pro ? (
              <p className="text-sm text-zinc-400 text-center py-2">
                You already have Pro. Adjust your badge and themes in{' '}
                <Link
                  to={profile ? profileEditorPath(profile, { tab: 'customize' }) : '/browse'}
                  className="text-white underline underline-offset-2"
                >
                  Edit profile → Customize
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-3">
                <Button
                  type="button"
                  disabled={!canVerify}
                  onClick={() => void onVerify()}
                  className="w-full h-12 rounded-full bg-white text-black hover:bg-zinc-100 font-medium gap-2 shadow-none border-0"
                >
                  <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
                  {busy ? 'Checking…' : 'Verify purchase'}
                </Button>

                <Button
                  variant="outline"
                  asChild
                  className="w-full h-11 rounded-full border-white/15 bg-transparent text-zinc-200 hover:bg-white/[0.06] hover:text-white"
                >
                  <a href={ERLC_PRO_ROBLOX_URL} target="_blank" rel="noopener noreferrer" className="gap-2">
                    Purchase on Roblox
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  </a>
                </Button>

                <p className="text-[11px] text-zinc-600 mt-2 text-center leading-relaxed">
                  Roblox → Settings → Privacy → set “Who can see my inventory?” to <span className="text-zinc-500">Everyone</span> so
                  we can see the game pass. If it still fails, the site needs an Open Cloud API key with{' '}
                  <span className="text-zinc-500">user.inventory-item:read</span>.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <Button asChild className="w-full h-12 rounded-full bg-white text-black hover:bg-zinc-100 font-medium">
                <Link to="/auth">Sign in to verify</Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="w-full h-11 rounded-full border-white/15 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
              >
                <a href={ERLC_PRO_ROBLOX_URL} target="_blank" rel="noopener noreferrer" className="gap-2">
                  Purchase on Roblox
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                </a>
              </Button>
            </div>
          )}
        </div>

        <p className="mt-8 max-w-md text-center text-xs text-zinc-600 leading-relaxed px-2">
          Manage your Pro look anytime under Edit profile. Questions? See{' '}
          <Link to="/docs" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-300">
            Docs
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Pro;
