import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Bird, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CANARY_PASS_STORAGE_KEY, isCanarySiteHost } from '@/lib/canaryHost';
import { getCanonicalSiteBaseUrl } from '@/lib/canonicalHost';
import {
  canaryPublicStatus,
  canaryValidateCode,
  canaryVerifyToken,
} from '@/lib/callCanarySession';

type GatePhase = 'loading' | 'no_session' | 'need_code' | 'ready';

export function CanaryGate({ children }: { children: ReactNode }) {
  const enforce = useMemo(() => isCanarySiteHost(), []);
  const [phase, setPhase] = useState<GatePhase>(enforce ? 'loading' : 'ready');
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const readPass = useCallback(() => {
    try {
      return sessionStorage.getItem(CANARY_PASS_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }, []);

  const clearPass = useCallback(() => {
    try {
      sessionStorage.removeItem(CANARY_PASS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const hydrate = useCallback(async () => {
    if (!enforce) {
      setPhase('ready');
      return;
    }
    setError(null);
    const status = await canaryPublicStatus();
    if (status.error) {
      setError(status.error);
    }
    if (!status.gate_required) {
      clearPass();
      setPhase('no_session');
      return;
    }
    const token = readPass();
    if (token) {
      const ok = await canaryVerifyToken(token);
      if (ok) {
        setPhase('ready');
        return;
      }
      clearPass();
    }
    setPhase('need_code');
  }, [clearPass, enforce, readPass]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!enforce || phase === 'loading') return;
    const id = window.setInterval(() => {
      void (async () => {
        const status = await canaryPublicStatus();
        if (!status.gate_required) {
          clearPass();
          setPhase('no_session');
        } else if (phase === 'ready') {
          const token = readPass();
          if (token) {
            const ok = await canaryVerifyToken(token);
            if (!ok) {
              clearPass();
              setPhase('need_code');
            }
          } else {
            setPhase('need_code');
          }
        }
      })();
    }, 45_000);
    return () => window.clearInterval(id);
  }, [clearPass, enforce, phase, readPass]);

  const submitCode = async () => {
    const raw = codeInput.trim().toLowerCase();
    if (!raw) {
      setError('Enter the test code from staff.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await canaryValidateCode(raw);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    try {
      sessionStorage.setItem(CANARY_PASS_STORAGE_KEY, res.access_token);
    } catch {
      setError('This browser blocked saving the pass (private window?).');
      return;
    }
    setCodeInput('');
    setPhase('ready');
  };

  if (!enforce) return <>{children}</>;

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-400" aria-hidden />
        <p className="text-sm text-zinc-400">Checking canary access…</p>
      </div>
    );
  }

  if (phase === 'no_session') {
    const main = getCanonicalSiteBaseUrl();
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-white/10 bg-zinc-900/80">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Bird className="h-7 w-7 text-zinc-200" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Canary is closed</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              There is no active staff testing session. Ask a staff member to start one from the main site&apos;s staff
              panel (Canary tab), then open this URL again with the test code they share.
            </p>
            <Button asChild variant="secondary" className="w-full">
              <a href={`${main}/staff?tab=canary`}>Open staff panel on main site</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'need_code') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-white/10 bg-zinc-900/80">
          <CardContent className="p-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Bird className="h-7 w-7 text-zinc-200" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Canary testing</h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Enter the test code a staff member generated when they started the session on{' '}
                <span className="text-zinc-200">erlc.directory</span>.
              </p>
            </div>
            <div className="space-y-2">
              <Input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Test code"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-center tracking-widest border-white/12 bg-black/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitCode();
                }}
              />
              {error ? <p className="text-xs text-red-400 text-center">{error}</p> : null}
            </div>
            <Button type="button" className="w-full" disabled={busy} onClick={() => void submitCode()}>
              {busy ? 'Checking…' : 'Unlock canary'}
            </Button>
            <p className="text-center text-xs text-zinc-500">
              <a href="/" className="underline-offset-4 hover:underline text-zinc-400">
                Refresh
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
