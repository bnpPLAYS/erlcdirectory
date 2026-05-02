import { useEffect, useState } from 'react';
import { Shield, Copy, Check, RefreshCw, Loader2, AlertCircle, X, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
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

const fnUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

const VerifyExperienceDialog = ({
  open,
  onOpenChange,
  experienceId,
  profileId,
  serverNameHint,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  experienceId: string;
  profileId: string;
  serverNameHint?: string;
  onVerified?: () => void;
}) => {
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<ExistingRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setCopied(false);
    fetchExisting();
    fetchGuilds();
  }, [open, experienceId]);

  // Poll the existing request so when the boss approves, the dialog updates.
  useEffect(() => {
    if (!open || !active || active.status !== 'pending') return;
    const t = setInterval(fetchExisting, 4000);
    return () => clearInterval(t);
  }, [open, active?.id, active?.status]);

  const fetchExisting = async () => {
    const { data } = await supabase
      .from('experience_verification_requests')
      .select('id, guild_id, guild_name, token, status, expires_at, approver_discord_username')
      .eq('experience_id', experienceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setActive(data as ExistingRequest);
      if (data.status === 'approved') onVerified?.();
    } else {
      setActive(null);
    }
  };

  const fetchGuilds = async () => {
    setLoadingGuilds(true);
    setErrorMsg(null);
    const { data, error } = await supabase.functions.invoke('discord-guilds', { body: {} });
    setLoadingGuilds(false);
    if (error || (data as any)?.error) {
      setErrorMsg((data as any)?.error || error?.message || 'Could not load your Discord servers.');
      return;
    }
    setGuilds((data as any).guilds);
  };

  const generateLink = async (guild: Guild) => {
    setGenerating(true);
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
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
    setGenerating(false);
    if (error) {
      toast({ title: 'Could not create link', description: error.message, variant: 'destructive' });
      return;
    }
    setActive(data as ExistingRequest);
    toast({ title: 'Verification link ready', description: 'Send it to a server admin.' });
  };

  const revoke = async () => {
    if (!active) return;
    const { error } = await supabase
      .from('experience_verification_requests')
      .delete()
      .eq('id', active.id);
    if (error) {
      toast({ title: 'Could not revoke', description: error.message, variant: 'destructive' });
      return;
    }
    setActive(null);
    toast({ title: 'Link revoked' });
  };

  const link = active ? `${window.location.origin}/verify/${active.token}` : '';

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const filteredGuilds = (guilds || []).filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );
  const adminGuilds = filteredGuilds.filter((g) => g.is_admin);
  const otherGuilds = filteredGuilds.filter((g) => !g.is_admin);

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
                Pick the Discord server this experience is from. We'll generate a one-time link for an admin to approve.
                {serverNameHint && <span className="block mt-0.5">For: <strong>{serverNameHint}</strong></span>}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {/* Active request panel */}
            {active && (
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-white/20',
                      active.status === 'approved' && 'border-emerald-500/40 text-emerald-300',
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
                      <Input value={link} readOnly className="font-mono text-xs" />
                      <Button size="sm" variant="secondary" onClick={copy} className="gap-1.5 shrink-0">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      One-time use. Expires {new Date(active.expires_at).toLocaleString()}.
                    </p>
                    <div className="flex justify-between items-center pt-1">
                      <Button size="sm" variant="ghost" onClick={fetchExisting} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" /> Check status
                      </Button>
                      <Button size="sm" variant="ghost" onClick={revoke} className="gap-1.5 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  </>
                )}
                {active.status === 'approved' && (
                  <p className="text-sm text-emerald-300 flex items-center gap-2">
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
                    <Button size="sm" variant="secondary" onClick={revoke}>Clear and try a new server</Button>
                  </div>
                )}
                {(active.status === 'expired' || active.status === 'revoked') && (
                  <Button size="sm" variant="secondary" onClick={revoke}>Generate a new link</Button>
                )}
              </div>
            )}

            {/* Guild picker (only when there's no pending request) */}
            {(!active || active.status !== 'pending') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your Discord servers…"
                  />
                  <Button size="sm" variant="secondary" onClick={fetchGuilds} className="gap-1.5">
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
                        You don't have Administrator in any of your servers. Pick one below; an admin from that server can still approve once you send them the link.
                      </p>
                    ) : null}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[...adminGuilds, ...otherGuilds].map((g) => (
                        <button
                          key={g.id}
                          onClick={() => generateLink(g)}
                          disabled={generating}
                          className="glass glass-hover rounded-lg p-3 flex items-center gap-3 text-left disabled:opacity-50"
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
