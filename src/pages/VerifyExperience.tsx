import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import logo from '@/assets/logo.png';
import { PENDING_EXPERIENCE_ROLE } from '@/lib/experienceConstants';
import { callExperienceVerify } from '@/lib/callExperienceVerify';
import { getDiscordClientId, getDiscordRedirectUri } from '@/lib/discordOAuth';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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
  /** Role names in this Discord server (from bot API when bot shares the server). */
  discord_roles?: { id: string; name: string }[];
}

type VerificationLookupResult = {
  request: RequestInfo;
  experience: ExperienceInfo | null;
  member: MemberInfo | null;
};

function experienceDateLabel(exp: ExperienceInfo): string {
  const start = new Date(exp.start_date).toLocaleDateString();
  if (exp.is_current) return `${start} — Present`;
  if (exp.end_date) return `${start} — ${new Date(exp.end_date).toLocaleDateString()}`;
  return start;
}

const VerifyExperience = () => {
  const { token } = useParams();
  const { session } = useAuth();
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
  const [verifierRating, setVerifierRating] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchInfo();
  }, [token, session?.access_token]);

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
    void finalizeDecision(parsed.action, code);
    const next = new URLSearchParams(params);
    next.delete('code');
    next.delete('state');
    setParams(next, { replace: true });
  }, [params, token]);

  const fetchInfo = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await callExperienceVerify<VerificationLookupResult>(
      'lookup',
      {
        token: token!,
      },
      session?.access_token ?? null,
    );
    setLoading(false);
    if (fnError || !data) {
      setError(fnError || 'This link is not valid.');
      return;
    }
    setInfo(data);
  };

  const validateApproveForm = (): string | null => {
    const theirRole = memberRole.trim();
    if (!theirRole) {
      return 'Enter the member\'s verified role or title (e.g. Patrol Officer, Staff).';
    }
    if (theirRole.length > 80) {
      return 'Member role is too long (80 characters max).';
    }
    const pos = verifierPosition.trim();
    if (!pos) {
      return 'Enter your position in this server (e.g. Server Owner, Head Administrator).';
    }
    if (pos.length > 160) {
      return 'Position is too long (160 characters max).';
    }
    if (verifierReviewText.length > 2000) {
      return 'Review text is too long (2000 characters max).';
    }
    return null;
  };

  /** Full-page Discord OAuth when not signed into the directory (or token refresh needed). */
  const startDiscord = (action: 'approve' | 'reject') => {
    if (!token) return;
    if (action === 'approve') {
      const err = validateApproveForm();
      if (err) {
        setError(err);
        return;
      }
      sessionStorage.setItem(
        APPROVE_EXTRAS_KEY(token),
        JSON.stringify({
          memberRole: memberRole.trim(),
          verifierPosition: verifierPosition.trim(),
          verifierReviewText: verifierReviewText.trim(),
          verifierRating,
        }),
      );
    } else {
      sessionStorage.removeItem(APPROVE_EXTRAS_KEY(token));
    }
    setError(null);
    const redirectUri = getDiscordRedirectUri();
    const clientId = getDiscordClientId();
    const state = btoa(JSON.stringify({ kind: 'verify', token, action }));
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });
    const url = `https://discord.com/oauth2/authorize?${q.toString()}`;
    window.location.href = url;
  };

  const handleApproveClick = () => {
    if (!token) return;
    const err = validateApproveForm();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (session?.access_token) {
      void finalizeDecision('approve');
    } else {
      startDiscord('approve');
    }
  };

  const handleRejectClick = () => {
    if (!token) return;
    setError(null);
    if (session?.access_token) {
      void finalizeDecision('reject');
    } else {
      startDiscord('reject');
    }
  };

  const finalizeDecision = async (action: 'approve' | 'reject', oauthCode?: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      let memberRoleBody = '';
      let verifierPositionBody = '';
      let verifierReviewTextBody = '';
      let verifierRatingBody: number | null = null;
      if (action === 'approve') {
        if (oauthCode) {
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
        } else {
          memberRoleBody = memberRole.trim();
          verifierPositionBody = verifierPosition.trim();
          verifierReviewTextBody = verifierReviewText.trim();
          verifierRatingBody = verifierRating;
        }
      }

      const payload: Record<string, unknown> = {
        token,
        memberRole: memberRoleBody,
        verifierPosition: verifierPositionBody,
        verifierReviewText: verifierReviewTextBody,
        verifierRating: verifierRatingBody,
      };
      if (oauthCode) {
        payload.code = oauthCode;
        payload.redirectUri = getDiscordRedirectUri();
      }

      const { data: json, error: fnErr } = await callExperienceVerify<{
        error?: string;
        status?: string;
        approver?: string;
      }>(action, payload, session?.access_token ?? null);
      if (fnErr || !json) {
        const needDiscordOAuth =
          !oauthCode &&
          !!fnErr &&
          (/Discord authorization required/i.test(fnErr) ||
            /Missing Discord authorization/i.test(fnErr));
        if (needDiscordOAuth) {
          startDiscord(action);
          return;
        }
        setError(fnErr || 'Could not complete verification.');
      } else {
        const status = json.status || (action === 'reject' ? 'rejected' : action);
        setDecisionResult({ status, approver: json.approver || '' });
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-14 sm:py-20">
        <div className="w-full max-w-lg space-y-8">
          <header className="text-center space-y-5">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2.5 text-zinc-100 hover:text-white transition-colors"
            >
              <img src={logo} alt="" className="logo-mark h-9 w-9 object-contain" width={36} height={36} aria-hidden />
              <span className="text-[13px] font-semibold tracking-[0.22em] uppercase text-zinc-200">erlc.directory</span>
            </Link>
            <div className="h-px w-16 mx-auto bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
            {session?.access_token ? (
              <p className="text-[11px] text-zinc-500 max-w-md mx-auto">Signed in — approval uses your directory account.</p>
            ) : (
              <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
                <Link to="/auth" className="text-zinc-300 underline-offset-4 hover:underline">
                  Sign in
                </Link>{' '}
                first to skip an extra Discord step when possible.
              </p>
            )}
          </header>

          <div className="border border-white/[0.12] bg-zinc-950/80 backdrop-blur-sm shadow-[0_28px_90px_-28px_rgba(0,0,0,0.9)]">
            <div className="border-b border-white/[0.08] px-6 py-5 sm:px-8">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.04]">
                  <Shield className="h-5 w-5 text-zinc-200" aria-hidden />
                </div>
                <div className="space-y-1.5 text-left min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">Verification request</p>
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white leading-snug">
                    Confirm workplace experience
                  </h1>
                  <p className="text-[13px] leading-relaxed text-zinc-400">
                    Only approve if you legitimately hold admin access in the Discord server below. You&apos;ll record
                    their role title and yours on file — optional written feedback.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-5">

            {loading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}

            {error && !info && (
              <div className="rounded-lg border border-amber-500/30 bg-black/40 p-4 text-center text-amber-200/90 flex flex-col items-center gap-2">
                <AlertTriangle className="h-6 w-6" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {info && r && (
              <>
                <div className="flex flex-col gap-3 border-b border-white/10 pb-5 mb-1">
                  <div className="flex flex-wrap items-start gap-4">
                    {m && (
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={m.discord_avatar || undefined} />
                          <AvatarFallback>{m.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate">{m.display_name || 'Member'}</p>
                          {m.discord_username && (
                            <p className="text-xs text-zinc-500">@{m.discord_username}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:min-w-[12rem]">
                      {r.guild_icon ? (
                        <img src={r.guild_icon} alt="" className="w-9 h-9 rounded-md shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 text-sm text-zinc-400">
                          {(r.guild_name || '?')[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Server</p>
                        <p className="text-sm text-zinc-200 truncate">{r.guild_name || r.guild_id}</p>
                      </div>
                    </div>
                    {e && (
                      <div className="text-xs text-zinc-500 min-w-0 flex-1 basis-full sm:basis-auto">
                        {e.role !== PENDING_EXPERIENCE_ROLE && (
                          <p className="text-zinc-300 font-medium">{e.role}</p>
                        )}
                        <p className="truncate">
                          {e.server_name}
                          {e.department && ` · ${e.department}`}
                        </p>
                        <p>{experienceDateLabel(e)}</p>
                      </div>
                    )}
                  </div>
                  {m?.discord_roles && m.discord_roles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.discord_roles.map((role) => (
                        <Badge
                          key={role.id}
                          variant="secondary"
                          className="font-normal text-[10px] border-white/12 bg-white/[0.05] text-zinc-300"
                        >
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {decisionResult ? (
                  <ResultPanel result={decisionResult} />
                ) : r.status === 'approved' ? (
                  <ResultPanel result={{ status: 'approved', approver: r.approver_discord_username || '' }} />
                ) : r.status === 'rejected' ? (
                  <ResultPanel result={{ status: 'rejected', approver: r.approver_discord_username || '' }} />
                ) : isExpired ? (
                  <div className="rounded-lg border border-amber-500/25 bg-black/40 p-4 text-center text-amber-200/95 flex flex-col items-center gap-2">
                    <Clock className="h-6 w-6" />
                    <p className="text-sm">This link has expired. Ask the member to send a fresh one.</p>
                  </div>
                ) : isPending ? (
                  <>
                    {error && (
                      <div className="rounded-lg border border-red-500/30 bg-black/40 p-3 text-sm text-red-300/95 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="rounded-lg border border-white/[0.1] bg-black/25 p-4 sm:p-5 space-y-4">
                      <p className="text-sm font-medium text-zinc-100">Details to record</p>
                      <p className="text-[12px] text-zinc-500 leading-relaxed">
                        We check that you have <span className="text-zinc-300">Administrator</span> or{' '}
                        <span className="text-zinc-300">Manage Roles</span> in{' '}
                        <span className="text-zinc-200">{r.guild_name || 'this server'}</span> (or you own the server).
                        {session?.access_token
                          ? ' Your signed-in session is used to talk to Discord — you should not need a second login.'
                          : ' If you are not signed in, the next step opens Discord once to confirm your access.'}
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="member-role" className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Their verified role / title *
                        </Label>
                        <Input
                          id="member-role"
                          value={memberRole}
                          onChange={(ev) => setMemberRole(ev.target.value)}
                          maxLength={80}
                          className="rounded-lg border-white/12 bg-zinc-950/80 text-zinc-100 placeholder:text-zinc-600"
                        />
                        <p className="text-[11px] text-zinc-500">
                          Shown as their job title on erlc.directory after approval.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verifier-position" className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Your role in this server *
                        </Label>
                        <Input
                          id="verifier-position"
                          value={verifierPosition}
                          onChange={(ev) => setVerifierPosition(ev.target.value)}
                          maxLength={160}
                          className="rounded-lg border-white/12 bg-zinc-950/80 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verifier-review" className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Short note (optional)
                        </Label>
                        <Textarea
                          id="verifier-review"
                          value={verifierReviewText}
                          onChange={(ev) => setVerifierReviewText(ev.target.value)}
                          maxLength={2000}
                          rows={4}
                          className="rounded-lg border-white/12 bg-zinc-950/80 text-zinc-100 resize-none min-h-[100px]"
                        />
                        <p className="text-[11px] text-zinc-500 text-right tabular-nums">
                          {verifierReviewText.length}/2000
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Rating (optional)
                        </Label>
                        <div
                          className="flex flex-wrap items-center gap-0.5"
                          role="group"
                          aria-label="Optional rating from 1 to 5 stars"
                        >
                          {[1, 2, 3, 4, 5].map((n) => {
                            const active = verifierRating !== null && n <= verifierRating;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setVerifierRating((prev) => (prev === n ? null : n))}
                                className="rounded-lg p-1 text-zinc-600 hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 transition-colors"
                                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                                aria-pressed={active}
                              >
                                <Star
                                  className={cn(
                                    'h-7 w-7 transition-colors duration-150',
                                    active
                                      ? 'fill-zinc-100 text-zinc-100'
                                      : 'fill-transparent text-zinc-600',
                                  )}
                                  strokeWidth={1.35}
                                />
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          Click again on the same star to clear. Counts toward their public reviews when your directory
                          account matches your Discord.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => handleRejectClick()}
                        className="gap-2 rounded-full border-white/20"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                      <Button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleApproveClick()}
                        className="gap-2 rounded-full bg-white text-black hover:bg-zinc-200 border border-white"
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </Button>
                    </div>
                  </>
                ) : null}
              </>
            )}
            </div>
          </div>

        <p className="text-[11px] text-zinc-500 text-center max-w-md mx-auto leading-relaxed pb-4">
          Restricted to server administrators or managers with Manage Roles. Decisions are attributed to your Discord
          handle for audit purposes.
        </p>
        </div>
      </div>
    </div>
  );
};

const ResultPanel = ({ result }: { result: { status: string; approver: string } }) => {
  const isApproved = result.status === 'approved';
  return (
    <div
      className={cn(
        'rounded-lg border px-5 py-6 text-center flex flex-col items-center gap-2',
        isApproved
          ? 'border-white/20 bg-white/[0.04] text-zinc-100'
          : 'border-white/15 bg-black/30 text-zinc-300',
      )}
    >
      {isApproved ? (
        <CheckCircle2 className="h-8 w-8 text-zinc-100" />
      ) : (
        <XCircle className="h-8 w-8 text-zinc-400" />
      )}
      <p className="font-semibold tracking-tight">{isApproved ? 'Recorded as verified' : 'Recorded as not approved'}</p>
      {result.approver && (
        <p className="text-[12px] text-zinc-500">Verifier @{result.approver}</p>
      )}
    </div>
  );
};

export default VerifyExperience;
