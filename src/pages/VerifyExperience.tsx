import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Shield, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';

const DISCORD_CLIENT_ID = '1495931923237703792';

interface RequestInfo {
  id: string;
  guild_id: string;
  guild_name: string | null;
  guild_icon: string | null;
  status: string;
  expires_at: string;
  decided_at: string | null;
  approver_discord_username: string | null;
}
interface ExperienceInfo {
  id: string;
  role: string;
  server_name: string;
  department: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
}
interface MemberInfo {
  id: string;
  display_name: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
}

const VerifyExperience = () => {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const [info, setInfo] = useState<{
    request: RequestInfo;
    experience: ExperienceInfo | null;
    member: MemberInfo | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisionResult, setDecisionResult] = useState<{
    status: string;
    approver: string;
  } | null>(null);

  // Use the statically-registered Discord callback URL so we don't have to
  // pre-register a unique redirect_uri per verification token.
  const redirectUri = `${window.location.origin}/discord/callback`;

  useEffect(() => {
    if (!token) return;
    fetchInfo();
  }, [token]);

  // Handle return from Discord
  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;
    let parsed: { token: string; action: 'approve' | 'reject' } | null = null;
    try { parsed = JSON.parse(atob(state)); } catch { /* ignore */ }
    if (!parsed || parsed.token !== token) return;
    // Strip the kind tag before processing

    if (!parsed || parsed.token !== token) return;
    submitDecision(parsed.action, code);
    // Clean URL
    const next = new URLSearchParams(params);
    next.delete('code');
    next.delete('state');
    setParams(next, { replace: true });
  }, [params, token]);

  const fetchInfo = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke('experience-verify', {
      body: { token },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      setError((data as any)?.error || error?.message || 'This link is not valid.');
      return;
    }
    setInfo(data as any);
  };

  const startDiscord = (action: 'approve' | 'reject') => {
    const state = btoa(JSON.stringify({ token, action }));
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'consent',
    });
    window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
  };

  const submitDecision = async (action: 'approve' | 'reject', code: string) => {
    finalizeDecision(action, code);
  };

  const finalizeDecision = async (action: 'approve' | 'reject', code: string) => {
    setSubmitting(true);
    try {
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/experience-verify?action=${action}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token, code, redirectUri }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Could not complete verification.');
      } else {
        setDecisionResult({ status: json.status, approver: json.approver });
        fetchInfo();
      }
    } catch (e: any) {
      setError(e?.message || 'Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const r = info?.request;
  const e = info?.experience;
  const m = info?.member;
  const isPending = r?.status === 'pending';
  const isExpired = r?.status === 'expired' || (r && new Date(r.expires_at).getTime() < Date.now() && r.status === 'pending');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <Link to="/" className="flex items-center justify-center gap-2 mb-2">
          <img src={logo} alt="ERLC Directory" className="w-8 h-8" />
          <span className="text-sm font-bold">ERLC Directory</span>
        </Link>

        <Card className="card-elevated liquid-edge">
          <CardContent className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl glass flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Experience verification</h1>
              <p className="text-sm text-muted-foreground">
                A member has asked you to confirm their role in a Discord server.
              </p>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}

            {error && !info && (
              <div className="glass rounded-xl p-4 text-center text-amber-300 flex flex-col items-center gap-2">
                <AlertTriangle className="h-6 w-6" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {info && r && (
              <>
                {/* Member card */}
                {m && (
                  <div className="glass rounded-xl p-4 flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={m.discord_avatar || undefined} />
                      <AvatarFallback>{m.display_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{m.display_name || 'Member'}</p>
                      {m.discord_username && (
                        <p className="text-xs text-muted-foreground">@{m.discord_username}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Experience card */}
                {e && (
                  <div className="glass rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                      <Shield className="h-3.5 w-3.5" /> Claimed role
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{e.role}</p>
                      <p className="text-sm text-muted-foreground">
                        {e.server_name}
                        {e.department && ` · ${e.department}`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.start_date).toLocaleDateString()} —{' '}
                      {e.is_current ? 'Present' : e.end_date ? new Date(e.end_date).toLocaleDateString() : '—'}
                    </p>
                  </div>
                )}

                {/* Server card */}
                <div className="glass rounded-xl p-4 flex items-center gap-3">
                  {r.guild_icon ? (
                    <img src={r.guild_icon} alt="" className="w-10 h-10 rounded-md" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                      {(r.guild_name || '?')[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Discord server</p>
                    <p className="font-semibold truncate">{r.guild_name || r.guild_id}</p>
                  </div>
                </div>

                {/* Status / actions */}
                {decisionResult ? (
                  <ResultPanel result={decisionResult} />
                ) : r.status === 'approved' ? (
                  <ResultPanel result={{ status: 'approved', approver: r.approver_discord_username || '' }} />
                ) : r.status === 'rejected' ? (
                  <ResultPanel result={{ status: 'rejected', approver: r.approver_discord_username || '' }} />
                ) : isExpired ? (
                  <div className="glass rounded-xl p-4 text-center text-amber-300 flex flex-col items-center gap-2">
                    <Clock className="h-6 w-6" />
                    <p className="text-sm">This link has expired. Ask the member to send a fresh one.</p>
                  </div>
                ) : isPending ? (
                  <>
                    {error && (
                      <div className="glass rounded-xl p-3 text-sm text-red-300 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-muted-foreground text-center">
                        You'll sign in with Discord. We'll verify you have <strong>Administrator</strong> permission in
                        <strong> {r.guild_name || 'this server'}</strong> before recording your decision.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          disabled={submitting}
                          onClick={() => startDiscord('reject')}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                        <Button
                          disabled={submitting}
                          onClick={() => startDiscord('approve')}
                          className="gap-2"
                        >
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Approve
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground text-center">
                        Expires {new Date(r.expires_at).toLocaleString()}
                      </p>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Only an admin of the listed Discord server can approve this. Your Discord username will be shown on the
          verified badge.
        </p>
      </div>
    </div>
  );
};

const ResultPanel = ({ result }: { result: { status: string; approver: string } }) => {
  const isApproved = result.status === 'approved';
  return (
    <div
      className={`glass rounded-xl p-5 text-center flex flex-col items-center gap-2 ${
        isApproved ? 'text-emerald-300' : 'text-red-300'
      }`}
    >
      {isApproved ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
      <p className="font-semibold">{isApproved ? 'Verified' : 'Rejected'}</p>
      {result.approver && (
        <p className="text-xs text-muted-foreground">
          Recorded with @{result.approver}
        </p>
      )}
    </div>
  );
};

export default VerifyExperience;
