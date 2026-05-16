import { useEffect, useState } from 'react';
import { Plus, Search, Server as ServerIcon, RefreshCw, Shield, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { filterPlaintext } from '@/lib/chatFilter';
import { isMissingPostsColumnError } from '@/lib/postsSchemaCompat';
import { publicErrorMessage } from '@/lib/clientErrorHandling';

const TYPES = [
  {
    value: 'hiring',
    label: 'Hiring',
    desc: 'Link an application, optional Discord membership check, and requirements.',
  },
  {
    value: 'looking',
    label: 'Looking for work',
    desc: 'Highlights your profile so server teams can reach you privately.',
  },
  { value: 'announcement', label: 'Announcement', desc: 'News or updates for the community.' },
  { value: 'discussion', label: 'Discussion', desc: 'Starts a thread others can reply to below the post.' },
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
  const [applicationUrl, setApplicationUrl] = useState('');
  const [requireGuildMember, setRequireGuildMember] = useState(false);
  const [requireRobloxVerified, setRequireRobloxVerified] = useState(false);
  const [extraRequirements, setExtraRequirements] = useState('');
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [guildSearch, setGuildSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);

  const hiring = type === 'hiring';
  const serverOptional = !hiring;

  const reset = () => {
    setTitle('');
    setContent('');
    setType('hiring');
    setApplicationUrl('');
    setRequireGuildMember(false);
    setRequireRobloxVerified(false);
    setExtraRequirements('');
    setSelectedGuild(null);
    setGuildSearch('');
  };

  const loadGuilds = async () => {
    if (!profile) return;
    setLoadingGuilds(true);
    try {
      const { data, error } = await supabase
        .from('experiences')
        .select('guild_id, server_name, server_icon')
        .eq('profile_id', profile.id)
        .eq('is_verified', true)
        .not('guild_id', 'is', null);
      if (error) throw error;
      const seen = new Set<string>();
      const list: Guild[] = [];
      for (const r of (data || []) as { guild_id: string; server_name: string; server_icon: string | null }[]) {
        if (!r.guild_id || seen.has(r.guild_id)) continue;
        seen.add(r.guild_id);
        list.push({ id: r.guild_id, name: r.server_name, icon: r.server_icon, owner: false, is_admin: false });
      }
      setGuilds(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast({ title: 'Verified servers failed to load', description: msg, variant: 'destructive' });
    } finally {
      setLoadingGuilds(false);
    }
  };

  useEffect(() => {
    if (open && guilds.length === 0) loadGuilds();
  }, [open]);

  const ensureServerRow = async (g: Guild): Promise<string | null> => {
    const { data: existing } = await supabase.from('servers').select('id').eq('guild_id', g.id).maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from('servers')
      .insert({
        name: g.name,
        icon: g.icon,
        guild_id: g.id,
        owner_id: null,
        is_hiring: hiring,
      })
      .select('id')
      .single();
    if (error) {
      toast({ title: 'Server link failed', description: publicErrorMessage('Please try again.', error), variant: 'destructive' });
      return null;
    }
    return created.id;
  };

  const submit = async () => {
    if (!profile) return;
    if (hiring && !selectedGuild) {
      toast({
        title: 'Pick a Discord server',
        description: 'Hiring posts must be tied to a server you are verified in.',
        variant: 'destructive',
      });
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
    const titleF = filterPlaintext(title.trim());
    const contentF = filterPlaintext(content.trim());
    if (titleF.blockedHits || contentF.blockedHits) {
      toast({ title: 'Some wording was adjusted to meet community guidelines.' });
    }
    const reqLines = extraRequirements
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    let applicationUrlClean: string | null = null;
    if (hiring && applicationUrl.trim()) {
      try {
        const u = new URL(applicationUrl.trim());
        if (u.protocol === 'http:' || u.protocol === 'https:') applicationUrlClean = u.toString();
        else throw new Error('invalid');
      } catch {
        toast({ title: 'Application URL needs http:// or https://', variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    let serverId: string | null = null;
    if (selectedGuild) {
      serverId = await ensureServerRow(selectedGuild);
      if (!serverId) {
        setSubmitting(false);
        return;
      }
    }

    const insertRow = {
      author_id: profile.id,
      type,
      title: titleF.text,
      content: contentF.text,
      server_id: serverId,
      application_url: hiring ? applicationUrlClean : null,
      require_guild_membership: hiring && requireGuildMember,
      require_roblox_verified: hiring && requireRobloxVerified,
      requirements: reqLines.length ? reqLines : null,
    };

    let { error } = await supabase.from('posts').insert(insertRow);
    if (error && isMissingPostsColumnError(error.message, 'require_roblox_verified')) {
      const { require_roblox_verified: _r, ...withoutRobloxCol } = insertRow;
      const retry = await supabase.from('posts').insert(withoutRobloxCol);
      error = retry.error;
      if (!error && hiring && requireRobloxVerified) {
        toast({
          title: 'Posted',
          description:
            'This project’s database is missing posts.require_roblox_verified. Run Supabase migrations (see migration 20260609120000 or 20260623130000) so the Roblox gate can be enforced.',
        });
        setOpen(false);
        reset();
        onCreated?.();
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    if (error) {
      toast({ title: 'Post did not save', description: publicErrorMessage('Please try again.', error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Posted!' });
    setOpen(false);
    reset();
    onCreated?.();
  };

  const filteredGuilds = guilds.filter((g) => g.name.toLowerCase().includes(guildSearch.toLowerCase()));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New post
        </Button>
      </DialogTrigger>
      <DialogContent fullscreen hideClose className="glass-strong p-0 gap-0 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0 pt-12">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create a post</h2>
              <p className="text-xs text-muted-foreground">Choose a type first—it controls how the post behaves.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            <section className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setType(t.value);
                      if (t.value !== 'hiring') {
                        setRequireGuildMember(false);
                        setRequireRobloxVerified(false);
                        setApplicationUrl('');
                      }
                    }}
                    className={cn(
                      'glass glass-hover rounded-xl p-4 text-left border transition-colors',
                      type === t.value ? 'border-primary/60 ring-1 ring-primary/40' : 'border-white/10',
                    )}
                  >
                    <p className="font-medium text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {hiring && (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Link2 className="h-3 w-3" /> Application &amp; requirements
                </Label>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Application URL (optional)</Label>
                  <Input
                    value={applicationUrl}
                    onChange={(e) => setApplicationUrl(e.target.value)}
                    placeholder="https://…"
                    inputMode="url"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="req-guild"
                    checked={requireGuildMember}
                    onCheckedChange={(v) => setRequireGuildMember(!!v)}
                  />
                  <div>
                    <label htmlFor="req-guild" className="text-sm font-medium cursor-pointer">
                      Require applicants to be in this Discord server
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Uses your Discord login to verify membership before opening the application link.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="req-roblox"
                    checked={requireRobloxVerified}
                    onCheckedChange={(v) => setRequireRobloxVerified(!!v)}
                  />
                  <div>
                    <label htmlFor="req-roblox" className="text-sm font-medium cursor-pointer">
                      Require applicants to be Roblox verified
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Applicants must complete &quot;Continue with Roblox&quot; in Edit profile (official OAuth) before
                      the application link opens.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Extra requirements (one per line)</Label>
                  <Textarea
                    value={extraRequirements}
                    onChange={(e) => setExtraRequirements(e.target.value)}
                    placeholder={'Must be 16+\nPrior moderation experience'}
                    rows={4}
                  />
                </div>
              </section>
            )}

            {type === 'looking' && (
              <p className="text-sm text-muted-foreground rounded-xl border border-white/10 bg-white/[0.02] p-4">
                Your profile will be linked on the post so hiring teams can open your directory listing and message you
                privately when in-app messaging is enabled.
              </p>
            )}

            {type === 'discussion' && (
              <p className="text-sm text-muted-foreground rounded-xl border border-white/10 bg-white/[0.02] p-4">
                Replies appear under this post. Keep the first message focused so the thread stays on-topic.
              </p>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Discord server {hiring ? '*' : '(optional)'}
                </Label>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={loadGuilds} disabled={loadingGuilds}>
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingGuilds && 'animate-spin')} />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                {hiring
                  ? 'Hiring posts must reference a server where your experience is verified.'
                  : 'Optionally tag a server. Skip if this post is general.'}
              </p>

              {serverOptional && (
                <button
                  type="button"
                  onClick={() => setSelectedGuild(null)}
                  className={cn(
                    'w-full glass rounded-lg px-3 py-2 text-left text-sm border transition-colors',
                    selectedGuild === null ? 'border-primary/60 ring-1 ring-primary/40' : 'border-white/10',
                  )}
                >
                  No server linked
                </button>
              )}

              {loadingGuilds ? (
                <div className="glass rounded-xl p-6 text-sm text-muted-foreground text-center">
                  Loading your verified servers…
                </div>
              ) : hiring && guilds.length === 0 ? (
                <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
                  You need at least one verified server experience to post a hiring thread. Add and verify an
                  experience first.
                </div>
              ) : (
                <>
                  {guilds.length > 3 && (
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
                            selected ? 'border-primary/60 ring-1 ring-primary/40' : 'border-white/10',
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
                            <p className="text-[11px] text-muted-foreground">Verified member</p>
                          </div>
                        </button>
                      );
                    })}
                    {filteredGuilds.length === 0 && guilds.length > 0 && (
                      <p className="col-span-full text-sm text-muted-foreground text-center py-4">No servers match.</p>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short headline for the board"
                maxLength={120}
              />
              <p className="text-[11px] text-muted-foreground text-right">{title.length}/120</p>
            </section>

            <section className="space-y-2">
              <Label>Details</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What people should know, how to engage, links in text if needed…"
                rows={10}
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground text-right">{content.length}/2000</p>
            </section>
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-4 flex items-center justify-end gap-2 shrink-0 bg-background/60 backdrop-blur">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || (hiring && !selectedGuild)} className="gap-2">
            {submitting ? 'Posting…' : 'Publish'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;
