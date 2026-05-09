import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const CreateServerDialog = ({ onCreated }: { onCreated?: () => void }) => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [discordInvite, setDiscordInvite] = useState('');
  const [robloxLink, setRobloxLink] = useState('');
  const [tags, setTags] = useState('');
  const [isHiring, setIsHiring] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!profile) return;
    if (name.trim().length < 2) {
      toast({ title: 'Server name too short', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('servers').insert({
      owner_id: profile.id,
      name: name.trim(),
      description: description.trim() || null,
      icon: icon.trim() || null,
      discord_invite: discordInvite.trim() || null,
      roblox_link: robloxLink.trim() || null,
      is_hiring: isHiring,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not create server', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Server listed!' });
    setOpen(false);
    setName('');
    setDescription('');
    setIcon('');
    setDiscordInvite('');
    setRobloxLink('');
    setTags('');
    setIsHiring(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full md:w-auto">
          <Plus className="h-4 w-4" /> List a server
        </Button>
      </DialogTrigger>
      <DialogContent fullscreen className="glass-strong p-0 gap-0 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold">List your server</h2>
            <p className="text-xs text-muted-foreground">Share what your community is about so the right people can find you.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
            <span aria-hidden>×</span>
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
            <div className="space-y-2">
              <Label>Server name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Liberty State RP" maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What makes your server unique?"
                rows={5}
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Icon URL</Label>
                <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="serious, whitelist, EMS" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Discord invite</Label>
                <Input value={discordInvite} onChange={(e) => setDiscordInvite(e.target.value)} placeholder="discord.gg/…" />
              </div>
              <div className="space-y-2">
                <Label>Roblox link</Label>
                <Input value={robloxLink} onChange={(e) => setRobloxLink(e.target.value)} placeholder="roblox.com/…" />
              </div>
            </div>
            <div className="flex items-center justify-between glass rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Currently hiring</p>
                <p className="text-xs text-muted-foreground">Show a hiring badge on your listing.</p>
              </div>
              <Switch checked={isHiring} onCheckedChange={setIsHiring} />
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-4 flex justify-end gap-2 bg-background/60 backdrop-blur shrink-0">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Listing…' : 'List server'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateServerDialog;
