import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  getPublicDiscordSignInMessage,
  getSupabaseDiscordCallbackUrl,
  isDiscordTokenExchangeFailure,
  parseOAuthErrorDescription,
} from '@/lib/discordOAuthErrors';
import { getDiscordRedirectUri, isFreshDiscordSignInState } from '@/lib/discordOAuth';
import { invokeDiscordOauthSignIn } from '@/lib/callDiscordOauthSignIn';
import { pullDiscordProfileAfterOAuth } from '@/lib/syncDiscordProfile';

function readOAuthParams() {
  const search = new URLSearchParams(window.location.search);
  const hash =
    window.location.hash && window.location.hash.length > 1
      ? new URLSearchParams(window.location.hash.slice(1))
      : null;
  const code = search.get('code') ?? hash?.get('code') ?? null;
  const state = search.get('state') ?? hash?.get('state') ?? null;
  const oauthError = search.get('error') ?? hash?.get('error') ?? null;
  const oauthErrorDesc = search.get('error_description') ?? hash?.get('error_description') ?? null;
  return { code, state, oauthError, oauthErrorDesc };
}

/** Clear OAuth params from address bar without reload (code must not be reused). */
function stripOAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  if (url.hash && url.hash.length > 1) {
    const h = new URLSearchParams(url.hash.slice(1));
    h.delete('code');
    h.delete('state');
    h.delete('error');
    h.delete('error_description');
    const rest = h.toString();
    url.hash = rest ? `#${rest}` : '';
  }
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

const DiscordCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting your Discord account...');
  const [showExchangeHelp, setShowExchangeHelp] = useState(false);

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

      try {
        const syncResult = await pullDiscordProfileAfterOAuth(session);
        if (syncResult.error) {
          console.warn('DiscordCallback profile sync:', syncResult.error.message);
        }
      } catch (e) {
        console.warn('DiscordCallback profile sync threw:', e);
      }

      stripOAuthParamsFromUrl();

      if (!cancelled) {
        setStatus('success');
        setMessage('Signed in. Redirecting…');
        window.location.replace(`${window.location.origin}/`);
      }
      return true;
    };

    void (async () => {
      const { code, state, oauthError, oauthErrorDesc } = readOAuthParams();

      if (oauthError) {
        const rawDetail = oauthErrorDesc ? parseOAuthErrorDescription(oauthErrorDesc) : '';
        console.warn('[Discord OAuth]', { code: oauthError, description: rawDetail });
        if (!cancelled) {
          setStatus('error');
          setShowExchangeHelp(isDiscordTokenExchangeFailure(rawDetail));
          setMessage(
            getPublicDiscordSignInMessage({
              oauthErrorCode: oauthError,
              rawDescription: rawDetail || oauthError,
              source: 'redirect',
            }),
          );
        }
        stripOAuthParamsFromUrl();
        return;
      }

      if (code && state) {
        try {
          const decoded = JSON.parse(atob(state)) as { kind?: string; token?: string; ts?: number };
          if (decoded?.kind === 'verify' && decoded?.token) {
            const fwd = new URLSearchParams({ code, state });
            navigate(`/verify/${decoded.token}?${fwd.toString()}`, { replace: true });
            return;
          }
          if (decoded?.kind === 'signin') {
            if (!isFreshDiscordSignInState(decoded)) {
              if (!cancelled) {
                setStatus('error');
                setShowExchangeHelp(false);
                setMessage('This sign-in step expired. Close this tab and use Sign in again from the site.');
              }
              stripOAuthParamsFromUrl();
              return;
            }
            const appRedirectTo = `${window.location.origin.replace(/\/+$/, '')}/`;
            const signIn = await invokeDiscordOauthSignIn({
              code,
              redirectUri: getDiscordRedirectUri(),
              appRedirectTo,
            });
            if (!signIn.ok) {
              if (!cancelled) {
                setStatus('error');
                setShowExchangeHelp(false);
                setMessage(signIn.error);
              }
              stripOAuthParamsFromUrl();
              return;
            }
            stripOAuthParamsFromUrl();
            window.location.assign(signIn.actionLink);
            return;
          }
        } catch {
          /* Opaque OAuth state (not our JSON) */
        }
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, sess) => {
        if (cancelled || finished) return;
        if (!sess?.user) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          void finishWithSession();
        }
      });

      // Existing session (already logged in)
      if (await finishWithSession()) {
        subscription.unsubscribe();
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();
          if (retrySession?.user) {
            finished = false;
            await finishWithSession();
            subscription.unsubscribe();
            return;
          }
          if (!cancelled) {
            setStatus('error');
            const raw = exchangeError.message || '';
            console.warn('[Discord OAuth exchange]', raw);
            setShowExchangeHelp(isDiscordTokenExchangeFailure(raw));
            setMessage(
              getPublicDiscordSignInMessage({
                oauthErrorCode: null,
                rawDescription: raw,
                source: 'exchange',
              }),
            );
          }
          subscription.unsubscribe();
          return;
        }
        finished = false;
        await finishWithSession();
        subscription.unsubscribe();
        return;
      }

      // No code: wait for async edge cases (another tab, slow storage)
      for (let i = 0; i < 120 && !cancelled && !finished; i++) {
        if (await finishWithSession()) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      if (!finished && !cancelled) {
        setStatus('error');
        setMessage("Sign-in didn't complete. Go back and use Sign in again.");
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
            {status === 'error' && showExchangeHelp && (
              <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Fix this in your Supabase + Discord apps</p>
                <p className="mt-2">
                  Supabase could not exchange Discord&apos;s authorization code. That almost always means the Discord{' '}
                  <strong className="text-foreground">Client Secret</strong> in Supabase does not match your Discord app, or Discord is missing Supabase&apos;s callback URL.
                </p>
                <ol className="mt-3 list-decimal space-y-2 pl-4">
                  <li>
                    <span className="text-foreground">Discord Developer Portal</span> → OAuth2 → Redirects → add{' '}
                    <code className="break-all rounded bg-black/40 px-1 py-0.5 text-[11px] text-zinc-200">
                      {getSupabaseDiscordCallbackUrl()}
                    </code>{' '}
                    (this is different from your website&apos;s <code className="text-[11px]">/discord/callback</code> URL).
                  </li>
                  <li>
                    <span className="text-foreground">Supabase</span> → Authentication → Providers → Discord → paste the same Discord app&apos;s{' '}
                    <strong className="text-foreground">Client ID</strong> and <strong className="text-foreground">Client Secret</strong> as on Discord (re-copy the secret if you rotated it).
                  </li>
                  <li>
                    <span className="text-foreground">Supabase</span> → Authentication → URL Configuration → Redirect URLs → include your site callback, e.g.{' '}
                    <code className="break-all rounded bg-black/40 px-1 py-0.5 text-[11px] text-zinc-200">
                      https://www.erlc.directory/discord/callback
                    </code>
                    .
                  </li>
                </ol>
              </div>
            )}
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
