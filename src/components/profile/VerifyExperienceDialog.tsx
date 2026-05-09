import { useEffect, useRef, useState } from 'react';
import { Shield, Copy, Check, RefreshCw, Loader2, AlertCircle, X, Trash2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { fetchDiscordGuilds } from '@/lib/fetchDiscordGuilds';
import { buildVerifyExperienceUrl } from '@/lib/publicSiteUrl';
import { cn } from '@/lib/utils';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  is_admin: boolean;
}

interface ExistingRequest {
  id: string;
  guild_id: string;
  guild_name: string | null;
  token: string;
  status: string;
  expires_at: string;
  approver_discord_username: string | null;
}

type LinkedGuild = { id: string; name: string; icon: string | null };

function hasUsablePendingLink(row: ExistingRequest | null): row is ExistingRequest {
  if (!row || row.status !== 'pending') return false;
  return new Date(row.expires_at).getTime() >= Date.now();
}

const VerifyExperienceDialog = ({
  open,
  onOpenChange,
  experienceId,
  profileId,
  serverNameHint,
  linkedGuild,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  experienceId: string;
  profileId: string;
  serverNameHint?: string;
  /** When set (server-linked experience), a verify link is created for this guild immediately—no server browser. */
  linkedGuild: LinkedGuild | null;
  onVerified?: () => void;
}) => {
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<ExistingRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showGuildPickerFallback, setShowGuildPickerFallback] = useState(false);
  const autoCopyDoneRef = useRef(false);

  const loadExisting = async (): Promise<ExistingRequest | null> => {
    const { data } = await supabase
      .from('experience_verification_requests')
      .select('id, guild_id, guild_name, token, status, expires_at, approver_discord_username')
      .eq('experience_id', experienceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const row = data as ExistingRequest;
      setActive(row);
      if (row.status === 'approved') onVerified?.();
      return row;
    }
    setActive(null);
    return null;
  };

  const createRequestForGuild = async (guild: LinkedGuild): Promise<boolean> => {
    setGenerating(true);
    try {
      const token =
        crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('experience_verification_requests')
        .insert({
          experience_id: experienceId,
          profile_id: profileId,
          guild_id: guild.id,
          guild_name: guild.name,
          guild_icon: guild.icon,
          token,
          expires_at: expires,
        })
        .select('id, guild_id, guild_name, token, status, expires_at, approver_discord_username')
        .single();
      if (error) {
        toast({ title: 'Could not create link', description: error.message, variant: 'destructive' });
        return false;
      }
      setActive(data as ExistingRequest);
      return true;
    } finally {
      setGenerating(false);
    }
  };

  const bootstrap = async () => {
    setErrorMsg(null);
    setShowGuildPickerFallback(false);
    setCopied(false);

    const row = await loadExisting();

    if (linkedGuild) {
      if (row?.status === 'approved') return;
      if (hasUsablePendingLink(row)) return;
      if (row?.status === 'rejected') return;

      const ok = await createRequestForGuild(linkedGuild);
      if (!ok) {
        setShowGuildPickerFallback(true);
        await loadGuilds();
      } else {
        await loadExisting();
      }
      return;
    }

    if (hasUsablePendingLink(row)) return;
    await loadGuilds();
  };

  useEffect(() => {
    if (!open) return;
    void bootstrap();
  }, [open, experienceId, linkedGuild?.id]);

  useEffect(() => {
    if (!open || !active || active.status !== 'pending') return;
    const t = setInterval(() => void loadExisting(), 4000);
    return () => clearInterval(t);
  }, [open, active?.id, active?.status]);

  useEffect(() => {
    if (!open) {
      autoCopyDoneRef.current = false;
      return;
    }
    if (!active?.id) {
      autoCopyDoneRef.current = false;
    }
  }, [open, active?.id]);

  useEffect(() => {
    if (!open || autoCopyDoneRef.current) return;
    if (!active || active.status !== 'pending') return;
    if (new Date(active.expires_at).getTime() < Date.now()) return;
    const url = buildVerifyExperienceUrl(active.token);
    autoCopyDoneRef.current = true;
    void (async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: 'Verification link copied',
          description: 'Paste it to a server admin with Administrator in that server.',
        });
      } catch {
        autoCopyDoneRef.current = false;
        toast({
          title: 'Could not copy automatically',
          description: 'Use the Copy button next to the link.',
          variant: 'destructive',
        });
      }
    })();
  }, [open, active?.id, active?.status, active?.token, active?.expires_at]);

  const loadGuilds = async () => {
    setLoadingGuilds(true);
    setErrorMsg(null);
    try {
      const list = await fetchDiscordGuilds();
      setGuilds(list as Guild[]);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not load your Discord servers.');
    } finally {
      setLoadingGuilds(false);
    }
  };

  const generateLink = async (guild: Guild) => {
    const ok = await createRequestForGuild({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
    });
    if (ok) await loadExisting();
  };

  const revoke = async () => {
    if (!active) return;
    const { error } = await supabase.from('experience_verification_requests').delete().eq('id', active.id);
    if (error) {
      toast({ title: 'Could not revoke', description: error.message, variant: 'destructive' });
      return;
    }
    setActive(null);
    toast({ title: 'Link revoked' });
    if (linkedGuild && !showGuildPickerFallback) {
      void createRequestForGuild(linkedGuild).then(() => loadExisting());
    }
  };

  const link = active ? buildVerifyExperienceUrl(active.token) : '';

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const filteredGuilds = (guilds || []).filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));
  const adminGuilds = filteredGuilds.filter((g) => g.is_admin);
  const otherGuilds = filteredGuilds.filter((g) => !g.is_admin);

  const useGuildPicker = !linkedGuild || showGuildPickerFallback;
  const linkedFlow = !!linkedGuild && !showGuildPickerFallback;
  const pendingLinkReady =
    !!active && active.status === 'pending' && new Date(active.expires_at).getTime() >= Date.now();
  const showGuildBrowser = useGuildPicker && !pendingLinkReady;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen className="glass-strong p-0 gap-0 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Verify experience</h2>
              <p className="text-xs text-muted-foreground">
                {linkedFlow ? (
                  <>
                    Link for <strong>{linkedGuild.name}</strong>. Send it to an admin with <strong>Administrator</strong>{' '}
                    in that server.
                  </>
                ) : (
                  <>
                    Pick the Discord server this experience is from. We&apos;ll generate a one-time link for an admin to
                    approve.
                    {serverNameHint && (
                      <span className="block mt-0.5">
                        For: <strong>{serverNameHint}</strong>
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {generating && linkedFlow && !active && (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating your verification link…
              </div>
            )}

            {active && (
              <div className="glass rounded-xl p-4 space-y-3 border border-white/10">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-white/20',
                      active.status === 'approved' && 'border-violet-500/40 text-violet-200',
                      active.status === 'rejected' && 'border-red-500/40 text-red-300',
                      active.status === 'expired' && 'border-amber-500/40 text-amber-300',
                    )}
                  >
                    {active.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground truncate">
                    Server: {active.guild_name || active.guild_id}
                  </span>
                </div>

                {active.status === 'pending' && (
                  <>
                    <div className="flex gap-2">
                      <Input value={link} readOnly className="font-mono text-xs rounded-xl" />
                      <Button size="sm" variant="secondary" onClick={copy} className="gap-1.5 shrink-0 rounded-full">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      One-time use. Expires {new Date(active.expires_at).toLocaleString()}.
                    </p>
                    <div className="flex justify-between items-center pt-1 flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => loadExisting()} className="gap-1.5 rounded-full">
                        <RefreshCw className="h-3.5 w-3.5" /> Check status
                      </Button>
                      <Button size="sm" variant="ghost" onClick={revoke} className="gap-1.5 text-destructive rounded-full">
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  </>
                )}
                {active.status === 'approved' && (
                  <p className="text-sm text-violet-200 flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Verified by @{active.approver_discord_username || 'admin'}.
                  </p>
                )}
                {active.status === 'rejected' && (
                  <div className="space-y-2">
                    <p className="text-sm text-red-300 flex items-center gap-2">
                      <X className="h-4 w-4" />
                      Rejected by @{active.approver_discord_username || 'admin'}.
                    </p>
                    {linkedGuild && !showGuildPickerFallback ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-full"
                        onClick={() => void createRequestForGuild(linkedGuild).then(() => loadExisting())}
                      >
                        Generate a new link for {linkedGuild.name}
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" className="rounded-full" onClick={revoke}>
                        Clear and try a new server
                      </Button>
                    )}
                  </div>
                )}
                {(active.status === 'expired' || active.status === 'revoked') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      if (linkedGuild && !showGuildPickerFallback) {
                        void createRequestForGuild(linkedGuild).then(() => loadExisting());
                      } else {
                        void revoke();
                      }
                    }}
                  >
                    Generate a new link
                  </Button>
                )}
              </div>
            )}

            {showGuildBrowser && (
              <div className="space-y-3">
                {showGuildPickerFallback && (
                  <div className="glass rounded-lg p-3 text-sm text-amber-200 border border-amber-500/25 flex gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Couldn&apos;t create a link automatically. Choose the Discord server this experience belongs to
                      below.
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your Discord servers…"
                    className="rounded-xl"
                  />
                  <Button size="sm" variant="secondary" onClick={loadGuilds} className="gap-1.5 rounded-full shrink-0">
                    <RefreshCw className={cn('h-3.5 w-3.5', loadingGuilds && 'animate-spin')} /> Refresh
                  </Button>
                </div>

                {errorMsg && (
                  <div className="glass rounded-lg p-3 text-sm flex items-start gap-2 text-amber-300">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {loadingGuilds && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading your Discord servers…
                  </div>
                )}

                {!loadingGuilds && guilds && (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Servers you can verify in</p>
                    {adminGuilds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        You don&apos;t have Administrator in any of your servers. Pick one below; an admin from that
                        server can still approve once you send them the link.
                      </p>
                    ) : null}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[...adminGuilds, ...otherGuilds].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => generateLink(g)}
                          disabled={generating}
                          className="glass glass-hover rounded-xl p-3 flex items-center gap-3 text-left disabled:opacity-50 border border-white/8"
                        >
                          {g.icon ? (
                            <img src={g.icon} alt="" className="w-8 h-8 rounded-md" />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-xs">
                              {g.name[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{g.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {g.owner ? 'Owner' : g.is_admin ? 'Administrator' : 'Member'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VerifyExperienceDialog;
