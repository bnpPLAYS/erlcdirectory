import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Blocks app interaction until new Discord-linked profiles accept Terms + Privacy.
 * Existing profiles are grandfathered in DB migration (`terms_accepted_at`).
 */
export function AcceptTermsGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  /** `null` from DB = must accept; `undefined` (legacy row) or ISO string = OK */
  const terms = profile?.terms_accepted_at;
  const needsAccept = !loading && !!user && !!profile && terms === null;

  const submit = async () => {
    if (!profile || !checked) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', profile.id);
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Could not save your acceptance.');
      return;
    }
    await refreshProfile();
    toast.success('Welcome aboard!');
  };

  return (
    <>
      {children}
      {needsAccept && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/12 bg-[hsl(240_6%_10%)] p-8 shadow-2xl animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-gate-title"
          >
            <h2 id="terms-gate-title" className="text-center text-xl font-semibold tracking-tight text-foreground">
              Almost there
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Review your Discord account and accept our terms to continue.
            </p>

            <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <Avatar className="h-12 w-12 ring-2 ring-white/10">
                <AvatarImage src={profile?.discord_avatar || undefined} loading="eager" />
                <AvatarFallback>{profile?.display_name?.[0] || '?'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {profile?.display_name || profile?.discord_username || 'Discord user'}
                </p>
                {profile?.discord_username && (
                  <p className="truncate text-sm text-muted-foreground">@{profile.discord_username}</p>
                )}
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black">
                <Check className="h-4 w-4" aria-hidden />
              </div>
            </div>

            <label className="mt-8 flex cursor-pointer items-start gap-3 text-sm leading-snug text-muted-foreground">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <Button
              type="button"
              className="mt-6 h-11 w-full rounded-xl bg-white text-black hover:bg-white/90 font-semibold"
              disabled={!checked || busy}
              onClick={submit}
            >
              {busy ? 'Saving…' : 'I agree & continue'}
            </Button>

            <button
              type="button"
              className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => signOut()}
            >
              Cancel and use a different account
            </button>
          </div>
        </div>
      )}
    </>
  );
}
