import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Server as ServerIcon,
  UserCheck,
  Search,
  RefreshCw,
  Shield,
  Users,
  Sparkles,
  Globe,
  Send,
  MessageCircleWarning,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { filterPlaintext } from '@/lib/chatFilter';
import { fetchDiscordGuilds } from '@/lib/fetchDiscordGuilds';
import { PENDING_EXPERIENCE_ROLE } from '@/lib/experienceConstants';
import { cn } from '@/lib/utils';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  is_admin: boolean;
}

export type CreatedExperienceSummary = {
  id: string;
  guild_id: string | null;
  server_name: string;
  server_icon: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profileId: string;
  onCreated: () => void;
  /** Opens verification link UI so the member can copy/send the link to an admin. */
  onRequestVerification?: (row: CreatedExperienceSummary) => void;
}

type Step = 'pick' | 'server' | 'direct' | 'aftercreate';

const AddExperienceDialog = ({ open, onOpenChange, profileId, onCreated, onRequestVerification }: Props) => {
  const [step, setStep] = useState<Step>('pick');
  const [savedRow, setSavedRow] = useState<CreatedExperienceSummary | null>(null);

  // Server flow
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);

  // Shared form
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);

  // Direct flow extras
  const [serverName, setServerName] = useState('');

  const [saving, setSaving] = useState(false);
  /** Blocks double-submits before React re-renders `saving` (double-clicks, fast taps). */
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!open) {
      submitLockRef.current = false;
      setStep('pick');
      setSelectedGuild(null);
      setRole('');
      setDescription('');
      setServerName('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setIsCurrent(true);
      setSearch('');
      setSavedRow(null);
    }
  }, [open]);

  const loadGuilds = async () => {
    setLoadingGuilds(true);
    try {
      const list = await fetchDiscordGuilds();
      setGuilds(list as Guild[]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load your Discord servers.');
    } finally {
      setLoadingGuilds(false);
    }
  };

  useEffect(() => {
    if (step === 'server' && guilds.length === 0) loadGuilds();
  }, [step]);

  const filteredGuilds = guilds.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  const canSubmitServer = !!selectedGuild && !!startDate;
  const canSubmitDirect = serverName.trim().length > 0 && role.trim().length > 0 && !!startDate;

  const submit = async (kind: 'server' | 'direct') => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSaving(true);
    try {
      const descF = filterPlaintext(description.trim());
      const directNameF = filterPlaintext(serverName.trim());
      const roleF = filterPlaintext(role.trim());
      if (kind === 'direct' && (roleF.blockedHits || descF.blockedHits || directNameF.blockedHits)) {
        toast.info('Some wording was adjusted to meet community guidelines.');
      }
      if (kind === 'server' && descF.blockedHits) {
        toast.info('Some wording was adjusted to meet community guidelines.');
      }
      const payload: Record<string, unknown> = {
        profile_id: profileId,
        description: descF.text.slice(0, 600) || null,
        start_date: startDate,
        end_date: isCurrent ? null : (endDate || null),
        is_current: isCurrent,
      };
      if (kind === 'server' && selectedGuild) {
        payload.role = PENDING_EXPERIENCE_ROLE;
        payload.server_name = selectedGuild.name.slice(0, 80);
        payload.server_icon = selectedGuild.icon;
        payload.guild_id = selectedGuild.id;
      } else {
        payload.role = roleF.text.slice(0, 80);
        payload.server_name = directNameF.text.slice(0, 80);
      }
      const { data: inserted, error } = await supabase
        .from('experiences')
        .insert(payload)
        .select('id, guild_id, server_name, server_icon')
        .single();
      if (error) {
        // Unique index on (profile_id, guild_id) for server-linked rows — catch racing double-submits.
        const code = (error as { code?: string }).code;
        const msg = String((error as { message?: string }).message ?? '');
        if (code === '23505' || /duplicate key|unique constraint/i.test(msg)) {
          toast.info('That Discord server is already on your experience list.');
          onCreated();
          onOpenChange(false);
          return;
        }
        throw error;
      }
      onCreated();
      setSavedRow(inserted as CreatedExperienceSummary);
      setStep('aftercreate');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save experience');
    } finally {
      setSaving(false);
      submitLockRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen className="glass border-0 p-0 overflow-y-auto bg-background/95">
        <div className="mx-auto max-w-5xl w-full px-4 sm:px-8 py-8 sm:py-12 space-y-8">
        {step === 'pick' && (
          <>
            <DialogHeader className="text-center items-center">
              <div className="h-12 w-12 rounded-2xl bg-white/10 grid place-items-center mb-2">
                <Sparkles className="h-6 w-6" />
              </div>
              <DialogTitle className="text-3xl sm:text-4xl font-semibold tracking-tight">Add new experience</DialogTitle>
              <DialogDescription className="text-base">
                Share your work and build your reputation.
              </DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-5 mt-6">
              <button
                type="button"
                onClick={() => setStep('server')}
                className="group text-left rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] hover:border-white/30 hover:from-white/[0.08] p-7 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-12 w-12 rounded-xl bg-white/10 group-hover:bg-white/15 flex items-center justify-center transition-colors">
                    <ServerIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">Server experience</div>
                    <div className="text-sm text-muted-foreground">Showcase work from a Discord server</div>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Shield className="h-4 w-4" /> Verified by server admins</li>
                  <li className="flex items-center gap-2"><Users className="h-4 w-4" /> Auto-filled server details</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Higher credibility rating</li>
                </ul>
              </button>

              <button
                type="button"
                onClick={() => setStep('direct')}
                className="group text-left rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] hover:border-white/30 hover:from-white/[0.08] p-7 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-12 w-12 rounded-xl bg-white/10 group-hover:bg-white/15 flex items-center justify-center transition-colors">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">Direct experience</div>
                    <div className="text-sm text-muted-foreground">One-on-one work and collaborations</div>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> Client-side verification</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Flexible project types</li>
                  <li className="flex items-center gap-2"><Globe className="h-4 w-4" /> Public verification link</li>
                </ul>
              </button>
            </div>
          </>
        )}

        {step === 'server' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <ServerIcon className="h-5 w-5" /> Server experience
              </DialogTitle>
              <DialogDescription>
                Pick the server and your dates. An admin will confirm your role when they approve the verification link.
              </DialogDescription>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Server picker */}
              <Card className="rounded-2xl border border-white/12 bg-[hsl(240_6%_9%/0.6)] shadow-xl shadow-black/20">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-foreground/90" />
                      </div>
                      <span className="font-semibold text-sm">Select server</span>
                    </div>
                    <Button size="icon" variant="ghost" className="rounded-full" onClick={loadGuilds} disabled={loadingGuilds}>
                      <RefreshCw className={`h-4 w-4 ${loadingGuilds ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 rounded-xl border-white/12 bg-white/[0.04] h-11"
                    />
                  </div>
                  <ScrollArea className="h-72">
                    <div className="space-y-2 pr-2">
                      {loadingGuilds && <p className="text-sm text-muted-foreground py-6 text-center">Loading your servers…</p>}
                      {!loadingGuilds && filteredGuilds.length === 0 && (
                        <p className="text-sm text-muted-foreground py-6 text-center">No servers match.</p>
                      )}
                      {filteredGuilds.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGuild(g)}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-xl p-3 text-left transition border',
                            selectedGuild?.id === g.id
                              ? 'border-violet-400/40 bg-violet-500/10 ring-1 ring-violet-400/25'
                              : 'border-white/8 hover:bg-white/[0.04] hover:border-white/12',
                          )}
                        >
                          {g.icon ? (
                            <img src={g.icon} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">
                              {g.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{g.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {g.owner ? 'Owner' : g.is_admin ? 'Administrator' : 'Member'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Details */}
              <Card className="rounded-2xl border border-white/12 bg-[hsl(240_6%_9%/0.6)] shadow-xl shadow-black/20">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-foreground/90" />
                    </div>
                    <span className="font-semibold text-sm">Experience details</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                    <Textarea
                      value={description}
                      maxLength={600}
                      rows={4}
                      onChange={(e) => setDescription(e.target.value)}
                      className="rounded-xl border-white/12 bg-white/[0.04] resize-none min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start date *</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl border-white/12 bg-white/[0.04]" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">End date</Label>
                      <Input type="date" value={endDate} disabled={isCurrent} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border-white/12 bg-white/[0.04]" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer">
                    <Switch checked={isCurrent} onCheckedChange={setIsCurrent} />
                    This is an active/ongoing position
                  </label>

                  <Button
                    type="button"
                    onClick={() => void submit('server')}
                    disabled={!canSubmitServer || saving}
                    className="w-full rounded-full h-11 font-medium"
                  >
                    {saving ? 'Saving…' : 'Create server experience'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="flex pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep('pick')} className="gap-2 rounded-full text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Back to experience types
              </Button>
            </div>
          </>
        )}

        {step === 'direct' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <UserCheck className="h-5 w-5" /> Direct experience
              </DialogTitle>
              <DialogDescription>Document one-on-one work or a collaboration.</DialogDescription>
            </DialogHeader>

            <Card className="rounded-2xl border border-white/12 bg-[hsl(240_6%_9%/0.6)] shadow-xl shadow-black/20 max-w-2xl mx-auto w-full">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Client / project name *</Label>
                  <Input
                    value={serverName}
                    maxLength={80}
                    onChange={(e) => setServerName(e.target.value)}
                    className="rounded-xl border-white/12 bg-white/[0.04]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Position *</Label>
                  <Input
                    value={role}
                    maxLength={80}
                    onChange={(e) => setRole(e.target.value)}
                    className="rounded-xl border-white/12 bg-white/[0.04]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                  <Textarea
                    value={description}
                    maxLength={600}
                    rows={4}
                    onChange={(e) => setDescription(e.target.value)}
                    className="rounded-xl border-white/12 bg-white/[0.04] resize-none min-h-[100px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start date *</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl border-white/12 bg-white/[0.04]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">End date</Label>
                    <Input type="date" value={endDate} disabled={isCurrent} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border-white/12 bg-white/[0.04]" />
                  </div>
                </div>
                <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer">
                  <Switch checked={isCurrent} onCheckedChange={setIsCurrent} />
                  This is an active/ongoing engagement
                </label>

                <Button
                  type="button"
                  onClick={() => void submit('direct')}
                  disabled={!canSubmitDirect || saving}
                  className="w-full rounded-full h-11 font-medium"
                >
                  {saving ? 'Saving…' : 'Create direct experience'}
                </Button>
              </CardContent>
            </Card>

            <div className="flex pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep('pick')} className="gap-2 rounded-full text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Back to experience types
              </Button>
            </div>
          </>
        )}

        {step === 'aftercreate' && savedRow && (
          <>
            <DialogHeader className="text-center items-center max-w-2xl mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-400/25 grid place-items-center mb-3">
                <MessageCircleWarning className="h-6 w-6 text-amber-200" aria-hidden />
              </div>
              <DialogTitle className="text-2xl sm:text-3xl">Next step: send the link to an administrator</DialogTitle>
              <DialogDescription asChild>
                <div className="text-base text-left space-y-3 pt-2 text-muted-foreground">
                  <p className="text-foreground/95">
                    Your experience is saved as <span className="font-semibold text-foreground">pending</span>. It stays that way until someone who can
                    approve your role opens your <span className="font-semibold text-foreground">verification link</span> and confirms it.
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      {savedRow.guild_id ? (
                        <>
                          Send the link to a <strong className="text-foreground">Discord administrator</strong> or manager for{' '}
                          <strong className="text-foreground">{savedRow.server_name}</strong> (or anyone they delegate).
                        </>
                      ) : (
                        <>
                          Send the link to someone who can verify this work — for example a <strong className="text-foreground">client</strong>,{' '}
                          <strong className="text-foreground">project lead</strong>, or <strong className="text-foreground">community host</strong>.
                        </>
                      )}
                    </li>
                    <li>They open the link, sign in with Discord if prompted, and approve. Your directory profile updates when they finish.</li>
                    <li>Verification links last <strong className="text-foreground">24 hours</strong>. You can create a new link anytime from your experience list.</li>
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto pt-2">
              {onRequestVerification ? (
                <Button
                  type="button"
                  className="rounded-full h-11 gap-2"
                  onClick={() => {
                    onRequestVerification(savedRow);
                    onOpenChange(false);
                  }}
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Get verification link
                </Button>
              ) : null}
              <Button
                type="button"
                variant={onRequestVerification ? 'outline' : 'default'}
                className="rounded-full h-11"
                onClick={() => onOpenChange(false)}
              >
                {onRequestVerification ? "Close — I'll find the link later" : 'Got it'}
              </Button>
            </div>
          </>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddExperienceDialog;
