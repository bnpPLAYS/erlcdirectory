import { useEffect, useState } from 'react';
import { Plus, X, Briefcase, Search, Server as ServerIcon, RefreshCw, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: 'hiring', label: 'Hiring', desc: 'Recruit staff for a server' },
  { value: 'looking', label: 'Looking for work', desc: 'Tell servers what role you want' },
  { value: 'announcement', label: 'Announcement', desc: 'Community update or news' },
  { value: 'discussion', label: 'Discussion', desc: 'Start a conversation' },
];

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  is_admin: boolean;
}

const CreatePostDialog = ({ onCreated }: { onCreated?: () => void }) => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('hiring');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [guildSearch, setGuildSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);

  const reset = () => {
    setTitle('');
    setContent('');
    setType('hiring');
    setSelectedGuild(null);
    setGuildSearch('');
  };

  const loadGuilds = async () => {
    setLoadingGuilds(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-guilds');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGuilds((data?.guilds || []) as Guild[]);
    } catch (e: any) {
      toast({ title: 'Could not load Discord servers', description: e?.message, variant: 'destructive' });
    } finally {
      setLoadingGuilds(false);
    }
  };

  useEffect(() => {
    if (open && guilds.length === 0) loadGuilds();
  }, [open]);

  const ensureServerRow = async (g: Guild): Promise<string | null> => {
    // Look up existing server by guild_id
    const { data: existing } = await supabase
      .from('servers')
      .select('id')
      .eq('guild_id', g.id)
      .maybeSingle();
    if (existing) return existing.id;
    // Create stub
    const { data: created, error } = await supabase
      .from('servers')
      .insert({
        name: g.name,
        icon: g.icon,
        guild_id: g.id,
        owner_id: g.is_admin ? profile?.id : null,
        is_hiring: type === 'hiring',
      })
      .select('id')
      .single();
    if (error) {
      toast({ title: 'Could not link server', description: error.message, variant: 'destructive' });
      return null;
    }
    return created.id;
  };

  const submit = async () => {
    if (!profile) return;
    if (!selectedGuild) {
      toast({ title: 'Pick a Discord server', description: 'Every opening must be linked to a server you belong to.', variant: 'destructive' });
      return;
    }
    if (title.trim().length < 3) {
      toast({ title: 'Title too short', variant: 'destructive' });
      return;
    }
    if (content.trim().length < 10) {
      toast({ title: 'Add a bit more detail', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const serverId = await ensureServerRow(selectedGuild);
    if (!serverId) {
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from('posts').insert({
      author_id: profile.id,
      type,
      title: title.trim(),
      content: content.trim(),
      server_id: serverId,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not create opening', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Posted!' });
    setOpen(false);
    reset();
    onCreated?.();
  };

  const filteredGuilds = guilds.filter((g) =>
    g.name.toLowerCase().includes(guildSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New opening
        </Button>
      </DialogTrigger>
      <DialogContent
        fullscreen
        className="glass-strong p-0 gap-0 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create an opening</h2>
              <p className="text-xs text-muted-foreground">Linked to a Discord server you belong to.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {/* Type picker */}
            <section className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      'glass glass-hover rounded-xl p-4 text-left border transition-colors',
                      type === t.value ? 'border-primary/60 ring-1 ring-primary/40' : 'border-white/10'
                    )}
                  >
                    <p className="font-medium text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Discord server picker */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Discord server *
                </Label>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={loadGuilds} disabled={loadingGuilds}>
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingGuilds && 'animate-spin')} />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Verifies you actually belong to the server. We'll auto-list it if it's new.
              </p>

              {loadingGuilds ? (
                <div className="glass rounded-xl p-6 text-sm text-muted-foreground text-center">Loading your Discord servers…</div>
              ) : guilds.length === 0 ? (
                <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
                  No Discord servers found. Re-link your Discord account if this is wrong.
                </div>
              ) : (
                <>
                  {guilds.length > 4 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={guildSearch}
                        onChange={(e) => setGuildSearch(e.target.value)}
                        placeholder="Search your servers…"
                        className="pl-9"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {filteredGuilds.map((g) => {
                      const selected = selectedGuild?.id === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGuild(g)}
                          className={cn(
                            'glass glass-hover rounded-lg p-3 flex items-center gap-3 text-left border transition-colors',
                            selected ? 'border-primary/60 ring-1 ring-primary/40' : 'border-white/10'
                          )}
                        >
                          {g.icon ? (
                            <img src={g.icon} alt="" className="w-9 h-9 rounded-md object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-secondary grid place-items-center text-sm font-semibold">
                              <ServerIcon className="h-4 w-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{g.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {g.owner ? 'Owner' : g.is_admin ? 'Admin' : 'Member'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {filteredGuilds.length === 0 && (
                      <p className="col-span-full text-sm text-muted-foreground text-center py-4">No servers match.</p>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Title */}
            <section className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hiring senior moderator for night shift"
                maxLength={120}
              />
              <p className="text-[11px] text-muted-foreground text-right">{title.length}/120</p>
            </section>

            {/* Details */}
            <section className="space-y-2">
              <Label>Details</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What you're looking for, requirements, how to apply…"
                rows={10}
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground text-right">{content.length}/2000</p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-4 flex items-center justify-end gap-2 shrink-0 bg-background/60 backdrop-blur">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={submitting || !selectedGuild}
            className="gap-2"
          >
            {submitting ? 'Posting…' : 'Post opening'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;
