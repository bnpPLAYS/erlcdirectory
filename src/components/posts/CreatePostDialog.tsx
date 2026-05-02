import { useEffect, useState } from 'react';
import { Plus, X, Briefcase, Search, AlertCircle, Server as ServerIcon } from 'lucide-react';
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
import { Link } from 'react-router-dom';

const TYPES = [
  { value: 'hiring', label: 'Hiring', desc: 'Recruit staff for a server you own', requiresServer: true },
  { value: 'looking', label: 'Looking for work', desc: 'Tell servers what role you want', requiresServer: false },
  { value: 'announcement', label: 'Announcement', desc: 'Community update or news', requiresServer: false },
  { value: 'discussion', label: 'Discussion', desc: 'Start a conversation', requiresServer: false },
];

interface OwnedServer {
  id: string;
  name: string;
  icon: string | null;
  is_hiring: boolean;
}

const CreatePostDialog = ({ onCreated }: { onCreated?: () => void }) => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('hiring');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [serverId, setServerId] = useState<string | null>(null);
  const [serverSearch, setServerSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [servers, setServers] = useState<OwnedServer[] | null>(null);
  const [loadingServers, setLoadingServers] = useState(false);

  const typeMeta = TYPES.find((t) => t.value === type)!;
  const needsServer = typeMeta.requiresServer;

  const reset = () => {
    setTitle('');
    setContent('');
    setType('hiring');
    setServerId(null);
    setServerSearch('');
  };

  useEffect(() => {
    if (!open || !profile) return;
    setLoadingServers(true);
    supabase
      .from('servers')
      .select('id, name, icon, is_hiring')
      .eq('owner_id', profile.id)
      .order('name')
      .then(({ data }) => {
        setServers((data || []) as OwnedServer[]);
        setLoadingServers(false);
      });
  }, [open, profile]);

  // Clear server selection when switching to a type that doesn't need one
  useEffect(() => {
    if (!needsServer) setServerId(null);
  }, [needsServer]);

  const submit = async () => {
    if (!profile) return;
    if (needsServer && !serverId) {
      toast({ title: 'Pick a server', description: 'Choose which of your servers this hiring post is for.', variant: 'destructive' });
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

  const filteredServers = (servers || []).filter((s) =>
    s.name.toLowerCase().includes(serverSearch.toLowerCase())
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
              <p className="text-xs text-muted-foreground">Share a hiring post, an application, or a community update.</p>
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

            {/* Server picker — only for hiring */}
            {needsServer && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Server you're hiring for *</Label>
                  {servers && servers.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">{servers.length} server{servers.length === 1 ? '' : 's'}</span>
                  )}
                </div>

                {loadingServers ? (
                  <div className="glass rounded-xl p-6 text-sm text-muted-foreground text-center">Loading your servers…</div>
                ) : !servers || servers.length === 0 ? (
                  <div className="glass rounded-xl p-6 text-center space-y-3">
                    <AlertCircle className="h-6 w-6 text-amber-300 mx-auto" />
                    <div>
                      <p className="font-medium text-sm">You don't own any listed servers yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        List a server first so you can post hiring openings for it.
                      </p>
                    </div>
                    <Link to="/servers" onClick={() => setOpen(false)}>
                      <Button size="sm" variant="secondary" className="gap-2">
                        <ServerIcon className="h-4 w-4" /> Go to my servers
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    {servers.length > 4 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={serverSearch}
                          onChange={(e) => setServerSearch(e.target.value)}
                          placeholder="Search your servers…"
                          className="pl-9"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                      {filteredServers.map((s) => {
                        const selected = serverId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setServerId(s.id)}
                            className={cn(
                              'glass glass-hover rounded-lg p-3 flex items-center gap-3 text-left border transition-colors',
                              selected ? 'border-primary/60 ring-1 ring-primary/40' : 'border-white/10'
                            )}
                          >
                            {s.icon ? (
                              <img src={s.icon} alt="" className="w-9 h-9 rounded-md object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-secondary grid place-items-center text-sm font-semibold">
                                {s.name[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{s.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {s.is_hiring ? 'Already marked hiring' : 'Owner'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                      {filteredServers.length === 0 && (
                        <p className="col-span-full text-sm text-muted-foreground text-center py-4">No servers match.</p>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

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
            disabled={submitting || (needsServer && !serverId)}
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
