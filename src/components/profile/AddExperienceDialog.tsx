import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Crown,
  User,
  Star,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import logo from '@/assets/logo.png';
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

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  is_admin: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profileId: string;
  onCreated: () => void;
}

type Step = 'pick' | 'server' | 'direct';

const AddExperienceDialog = ({ open, onOpenChange, profileId, onCreated }: Props) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('pick');

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

  useEffect(() => {
    if (!open) {
      setStep('pick');
      setSelectedGuild(null);
      setRole('');
      setDescription('');
      setServerName('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setIsCurrent(true);
      setSearch('');
    }
  }, [open]);

  const loadGuilds = async () => {
    setLoadingGuilds(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-guilds');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGuilds((data?.guilds || []) as Guild[]);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load your Discord servers.');
    } finally {
      setLoadingGuilds(false);
    }
  };

  useEffect(() => {
    if (step === 'server' && guilds.length === 0) loadGuilds();
  }, [step]);

  const filteredGuilds = guilds.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  const canSubmitServer = !!selectedGuild && role.trim().length > 0 && !!startDate;
  const canSubmitDirect = serverName.trim().length > 0 && role.trim().length > 0 && !!startDate;

  const submit = async (kind: 'server' | 'direct') => {
    setSaving(true);
    try {
      const roleF = filterPlaintext(role.trim());
      const descF = filterPlaintext(description.trim());
      const directNameF = filterPlaintext(serverName.trim());
      if (roleF.blockedHits || descF.blockedHits || directNameF.blockedHits) {
        toast.info('Some wording was adjusted to meet community guidelines.');
      }
      const payload: Record<string, unknown> = {
        profile_id: profileId,
        role: roleF.text.slice(0, 80),
        description: descF.text.slice(0, 600) || null,
        start_date: startDate,
        end_date: isCurrent ? null : (endDate || null),
        is_current: isCurrent,
      };
      if (kind === 'server' && selectedGuild) {
        payload.server_name = selectedGuild.name.slice(0, 80);
        payload.server_icon = selectedGuild.icon;
        payload.guild_id = selectedGuild.id;
      } else {
        payload.server_name = directNameF.text.slice(0, 80);
      }
      const { error } = await supabase.from('experiences').insert(payload);
      if (error) throw error;
      toast.success('Experience added');
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save experience');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen className="glass p-0 overflow-y-auto">
        {step === 'pick' ? (
          <div className="flex min-h-[100dvh] flex-col items-center px-4 py-10 sm:py-14 pb-16">
            <div className="flex w-full max-w-4xl flex-col items-center text-center">
              <img
                src={logo}
                alt=""
                className="logo-mark mb-8 h-14 w-14 object-contain sm:h-16 sm:w-16"
                width={64}
                height={64}
                aria-hidden
              />
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Add New Experience
              </h2>
              <p className="mt-3 max-w-lg text-base text-muted-foreground">
                Share your work and build your reputation in the ER:LC community.
              </p>

              <div className="mt-10 grid w-full gap-5 md:grid-cols-2 md:gap-6">
                <button
                  type="button"
                  onClick={() => setStep('server')}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:from-white/[0.1]"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 transition-colors group-hover:bg-white/[0.14]">
                      <ServerIcon className="h-6 w-6 text-foreground" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-foreground">Server Experience</div>
                      <div className="text-sm text-muted-foreground">
                        Showcase your work from Discord servers
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2.5">
                      <Shield className="h-4 w-4 shrink-0 text-foreground/80" />
                      Verified by server management
                    </li>
                    <li className="flex items-center gap-2.5">
                      <User className="h-4 w-4 shrink-0 text-foreground/80" />
                      Automatic server details
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Crown className="h-4 w-4 shrink-0 text-foreground/80" />
                      Higher credibility rating
                    </li>
                  </ul>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('direct')}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:from-white/[0.1]"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 transition-colors group-hover:bg-white/[0.14]">
                      <UserCheck className="h-6 w-6 text-foreground" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-foreground">Direct Experience</div>
                      <div className="text-sm text-muted-foreground">
                        One-on-one work and collaborations
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2.5">
                      <UserCheck className="h-4 w-4 shrink-0 text-foreground/80" />
                      Client verification available
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Star className="h-4 w-4 shrink-0 text-foreground/80" />
                      Flexible project types
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Globe className="h-4 w-4 shrink-0 text-foreground/80" />
                      Public verification link
                    </li>
                  </ul>
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-12 gap-2 rounded-full border-white/20 bg-white/5 px-8 text-foreground hover:bg-white/10"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/browse');
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Browse
              </Button>
            </div>
          </div>
        ) : (
        <div className="mx-auto max-w-5xl w-full px-4 sm:px-8 py-8 sm:py-12 space-y-6">

        {step === 'server' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <ServerIcon className="h-5 w-5" /> Server experience
              </DialogTitle>
              <DialogDescription>Add an experience from a Discord server you're part of.</DialogDescription>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Server picker */}
              <Card className="card-elevated">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-white/10 flex items-center justify-center">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium">Select server</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={loadGuilds} disabled={loadingGuilds}>
                      <RefreshCw className={`h-4 w-4 ${loadingGuilds ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search servers…"
                      className="pl-8"
                    />
                  </div>
                  <ScrollArea className="h-72">
                    <div className="space-y-1.5 pr-2">
                      {loadingGuilds && <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>}
                      {!loadingGuilds && filteredGuilds.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">No servers found.</p>
                      )}
                      {filteredGuilds.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setSelectedGuild(g)}
                          className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition border ${
                            selectedGuild?.id === g.id
                              ? 'border-white/40 bg-white/[0.06]'
                              : 'border-white/5 hover:bg-white/[0.04]'
                          }`}
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
                              {g.owner ? 'Owner' : g.is_admin ? 'Admin' : 'Member'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Details */}
              <Card className="card-elevated">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-white/10 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium">Experience details</span>
                  </div>

                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Position *</Label>
                    <Input
                      value={role}
                      maxLength={80}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Patrol Officer, Staff, Lead Developer"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                    <Textarea
                      value={description}
                      maxLength={600}
                      rows={3}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your responsibilities, achievements, and impact…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start date *</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">End date</Label>
                      <Input type="date" value={endDate} disabled={isCurrent} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={isCurrent} onCheckedChange={setIsCurrent} />
                    This is an active/ongoing position
                  </label>

                  <Button
                    onClick={() => submit('server')}
                    disabled={!canSubmitServer || saving}
                    className="w-full"
                  >
                    {saving ? 'Saving…' : 'Create server experience'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="flex">
              <Button variant="ghost" onClick={() => setStep('pick')} className="gap-2">
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

            <Card className="card-elevated">
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Client / project name *</Label>
                  <Input
                    value={serverName}
                    maxLength={80}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="Who or what was this for?"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Position *</Label>
                  <Input
                    value={role}
                    maxLength={80}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Freelance Developer, Consultant"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                  <Textarea
                    value={description}
                    maxLength={600}
                    rows={3}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the work and the outcome…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start date *</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">End date</Label>
                    <Input type="date" value={endDate} disabled={isCurrent} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={isCurrent} onCheckedChange={setIsCurrent} />
                  This is an active/ongoing engagement
                </label>

                <Button
                  onClick={() => submit('direct')}
                  disabled={!canSubmitDirect || saving}
                  className="w-full"
                >
                  {saving ? 'Saving…' : 'Create direct experience'}
                </Button>
              </CardContent>
            </Card>

            <div className="flex">
              <Button variant="ghost" onClick={() => setStep('pick')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to experience types
              </Button>
            </div>
          </>
        )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddExperienceDialog;
