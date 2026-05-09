import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Shield, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import logo from '@/assets/logo.png';
import { PENDING_EXPERIENCE_ROLE } from '@/lib/experienceConstants';
import { callExperienceVerify } from '@/lib/callExperienceVerify';
import { getDiscordClientId, getDiscordRedirectUri } from '@/lib/discordOAuth';
const APPROVE_EXTRAS_KEY = (t: string) => `experience-verify-approve:${t}`;

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

type VerificationLookupResult = {
  request: RequestInfo;
  experience: ExperienceInfo | null;
  member: MemberInfo | null;
};

const VerifyExperience = () => {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const [info, setInfo] = useState<VerificationLookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisionResult, setDecisionResult] = useState<{
    status: string;
    approver: string;
  } | null>(null);

  const [memberRole, setMemberRole] = useState('');
  const [verifierPosition, setVerifierPosition] = useState('');
  const [verifierReviewText, setVerifierReviewText] = useState('');
  const [verifierRating, setVerifierRating] = useState<string>('');

  useEffect(() => {
    if (!token) return;
    fetchInfo();
  }, [token]);

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;
    let parsed: { token: string; action: 'approve' | 'reject' } | null = null;
    try {
      parsed = JSON.parse(atob(state));
    } catch {
      /* ignore */
    }
    if (!parsed || parsed.token !== token) return;
    submitDecision(parsed.action, code);
    const next = new URLSearchParams(params);
    next.delete('code');
    next.delete('state');
    setParams(next, { replace: true });
  }, [params, token]);

  const fetchInfo = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await callExperienceVerify<VerificationLookupResult>('lookup', {
      token: token!,
    });
    setLoading(false);
    if (fnError || !data) {
      setError(fnError || 'This link is not valid.');
      return;
    }
    setInfo(data);
  };

  const startDiscord = (action: 'approve' | 'reject') => {
    if (!token) return;
    if (action === 'approve') {
      const theirRole = memberRole.trim();
      if (!theirRole) {
        setError('Enter the member\'s verified role or title (e.g. Patrol Officer, Staff).');
        return;
      }
      if (theirRole.length > 80) {
        setError('Member role is too long (80 characters max).');
        return;
      }
      const pos = verifierPosition.trim();
      if (!pos) {
        setError('Enter your position in this server before approving (e.g. Server Owner, Head Administrator).');
        return;
      }
      if (pos.length > 160) {
        setError('Position is too long (160 characters max).');
        return;
      }
      if (verifierReviewText.length > 2000) {
        setError('Review text is too long (2000 characters max).');
        return;
      }
      let ratingNum: number | null = null;
      if (verifierRating) {
        ratingNum = Number(verifierRating);
        if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
          setError('Choose a star rating from 1–5, or clear the rating.');
          return;
        }
      }
      sessionStorage.setItem(
        APPROVE_EXTRAS_KEY(token),
        JSON.stringify({
          memberRole: theirRole,
          verifierPosition: pos,
          verifierReviewText: verifierReviewText.trim(),
          verifierRating: ratingNum,
        }),
      );
    } else {
      sessionStorage.removeItem(APPROVE_EXTRAS_KEY(token));
    }
    setError(null);
    const redirectUri = getDiscordRedirectUri();
    const state = btoa(JSON.stringify({ kind: 'verify', token, action }));
    const q = new URLSearchParams({
      client_id: getDiscordClientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'consent',
    });
    window.location.href = `https://discord.com/oauth2/authorize?${q.toString()}`;
  };

  const submitDecision = async (action: 'approve' | 'reject', code: string) => {
    finalizeDecision(action, code);
  };

  const finalizeDecision = async (action: 'approve' | 'reject', code: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      let memberRoleBody = '';
      let verifierPositionBody = '';
      let verifierReviewTextBody = '';
      let verifierRatingBody: number | null = null;
      if (action === 'approve') {
        const raw = sessionStorage.getItem(APPROVE_EXTRAS_KEY(token));
        sessionStorage.removeItem(APPROVE_EXTRAS_KEY(token));
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as {
              memberRole?: string;
              verifierPosition?: string;
              verifierReviewText?: string;
              verifierRating?: number | null;
            };
            memberRoleBody = (parsed.memberRole ?? '').toString();
            verifierPositionBody = (parsed.verifierPosition ?? '').toString();
            verifierReviewTextBody = (parsed.verifierReviewText ?? '').toString();
            verifierRatingBody =
              parsed.verifierRating !== undefined && parsed.verifierRating !== null
                ? Number(parsed.verifierRating)
                : null;
          } catch {
            /* use empty */
          }
        }
      }

      const { data: json, error: fnErr } = await callExperienceVerify<{
        error?: string;
        status?: string;
        approver?: string;
      }>(action, {
        token,
        code,
        redirectUri: getDiscordRedirectUri(),
        memberRole: memberRoleBody,
        verifierPosition: verifierPositionBody,
        verifierReviewText: verifierReviewTextBody,
        verifierRating: verifierRatingBody,
      });
      if (fnErr || !json) {
        setError(fnErr || 'Could not complete verification.');
      } else {
        setDecisionResult({ status: json.status || action, approver: json.approver || '' });
        fetchInfo();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const r = info?.request;
  const e = info?.experience;
  const m = info?.member;
  const isPending = r?.status === 'pending';
  const isExpired =
    r?.status === 'expired' || (r && new Date(r.expires_at).getTime() < Date.now() && r.status === 'pending');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <Link to="/" className="flex items-center justify-center gap-2 mb-2">
          <img src={logo} alt="" className="logo-mark w-8 h-8 object-contain" width={32} height={32} aria-hidden />
          <span className="text-sm font-bold">ERLC Directory</span>
        </Link>

        <Card className="card-elevated liquid-edge border-white/12">
          <CardContent className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl glass flex items-center justify-center border border-white/10">
                <Shield className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Experience verification</h1>
              <p className="text-sm text-muted-foreground">
                Approve only if you can confirm this member&apos;s role. You will set their title and your own staff
                position, with an optional review.
              </p>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}

            {error && !info && (
              <div className="glass rounded-xl p-4 text-center text-amber-300 flex flex-col items-center gap-2 border border-amber-500/20">
                <AlertTriangle className="h-6 w-6" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {info && r && (
              <>
                {m && (
                  <div className="glass rounded-xl p-4 flex items-center gap-3 border border-white/10">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={m.discord_avatar || undefined} />
                      <AvatarFallback>{m.display_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{m.display_name || 'Member'}</p>
                      {m.discord_username && <p className="text-xs text-muted-foreground">@{m.discord_username}</p>}
                    </div>
                  </div>
                )}

                {e && (
                  <div className="glass rounded-xl p-4 space-y-2 border border-white/10">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                      <Shield className="h-3.5 w-3.5" />{' '}
                      {e.role === PENDING_EXPERIENCE_ROLE ? 'Role' : 'Previous title'}
                    </div>
                    <div>
                      <p className="text-lg font-semibold">
                        {e.role === PENDING_EXPERIENCE_ROLE ? (
                          <span className="text-muted-foreground font-normal text-base">
                            Not set yet — you will enter their verified role below.
                          </span>
                        ) : (
                          e.role
                        )}
                      </p>
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

                <div className="glass rounded-xl p-4 flex items-center gap-3 border border-white/10">
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

                {decisionResult ? (
                  <ResultPanel result={decisionResult} />
                ) : r.status === 'approved' ? (
                  <ResultPanel result={{ status: 'approved', approver: r.approver_discord_username || '' }} />
                ) : r.status === 'rejected' ? (
                  <ResultPanel result={{ status: 'rejected', approver: r.approver_discord_username || '' }} />
                ) : isExpired ? (
                  <div className="glass rounded-xl p-4 text-center text-amber-300 flex flex-col items-center gap-2 border border-amber-500/20">
                    <Clock className="h-6 w-6" />
                    <p className="text-sm">This link has expired. Ask the member to send a fresh one.</p>
                  </div>
                ) : isPending ? (
                  <>
                    {error && (
                      <div className="glass rounded-xl p-3 text-sm text-red-300 flex items-start gap-2 border border-red-500/25">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="rounded-xl border border-white/12 bg-white/[0.03] p-4 space-y-4">
                      <p className="text-sm font-medium text-foreground">Before you approve</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        You must sign in with Discord so we can confirm you have <strong>Administrator</strong> in{' '}
                        <strong>{r.guild_name || 'this server'}</strong>.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="member-role" className="text-xs uppercase tracking-wide text-muted-foreground">
                          Their verified role / title *
                        </Label>
                        <Input
                          id="member-role"
                          value={memberRole}
                          onChange={(ev) => setMemberRole(ev.target.value)}
                          placeholder="e.g. Patrol Officer, Staff, Lead Developer"
                          maxLength={80}
                          className="rounded-xl border-white/12 bg-white/[0.04]"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          This becomes their position on the directory after you approve.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verifier-position" className="text-xs uppercase tracking-wide text-muted-foreground">
                          Your position in this server *
                        </Label>
                        <Input
                          id="verifier-position"
                          value={verifierPosition}
                          onChange={(ev) => setVerifierPosition(ev.target.value)}
                          placeholder="e.g. Owner, Director, Head Administrator"
                          maxLength={160}
                          className="rounded-xl border-white/12 bg-white/[0.04]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verifier-review" className="text-xs uppercase tracking-wide text-muted-foreground">
                          Review (optional)
                        </Label>
                        <Textarea
                          id="verifier-review"
                          value={verifierReviewText}
                          onChange={(ev) => setVerifierReviewText(ev.target.value)}
                          placeholder="Brief feedback on working with this member…"
                          maxLength={2000}
                          rows={4}
                          className="rounded-xl border-white/12 bg-white/[0.04] resize-none min-h-[100px]"
                        />
                        <p className="text-[11px] text-muted-foreground text-right tabular-nums">
                          {verifierReviewText.length}/2000
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verifier-rating" className="text-xs uppercase tracking-wide text-muted-foreground">
                          Star rating (optional)
                        </Label>
                        <select
                          id="verifier-rating"
                          value={verifierRating}
                          onChange={(ev) => setVerifierRating(ev.target.value)}
                          className="w-full h-10 rounded-xl border border-white/12 bg-white/[0.04] px-3 text-sm"
                        >
                          <option value="">No rating — text only</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={String(n)}>
                              {n} star{n === 1 ? '' : 's'}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-muted-foreground">
                          If you have a directory account linked to this Discord, a 1–5 rating also updates their
                          public reviews.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => startDiscord('reject')}
                          className="gap-2 rounded-full border-white/20"
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                        <Button
                          type="button"
                          disabled={submitting}
                          onClick={() => startDiscord('approve')}
                          className="gap-2 rounded-full"
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
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
          Only an administrator of the listed Discord server can complete this. Your Discord username is stored with
          the decision.
        </p>
      </div>
    </div>
  );
};

const ResultPanel = ({ result }: { result: { status: string; approver: string } }) => {
  const isApproved = result.status === 'approved';
  return (
    <div
      className={`glass rounded-xl p-5 text-center flex flex-col items-center gap-2 border ${
        isApproved ? 'text-violet-200 border-violet-500/25' : 'text-red-300 border-red-500/20'
      }`}
    >
      {isApproved ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
      <p className="font-semibold">{isApproved ? 'Verified' : 'Rejected'}</p>
      {result.approver && (
        <p className="text-xs text-muted-foreground">Recorded with @{result.approver}</p>
      )}
    </div>
  );
};

export default VerifyExperience;
