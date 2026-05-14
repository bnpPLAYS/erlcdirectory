import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { submitServerClaim } from '@/lib/callServerClaim';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  serverName: string;
  onSubmitted?: () => void;
};

export function ServerClaimDialog({ open, onOpenChange, serverId, serverName, onSubmitted }: Props) {
  const [discordLink, setDiscordLink] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setDiscordLink('');
      setMessage('');
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    const link = discordLink.trim();
    if (link.length < 8) {
      toast.error('Add a Discord link or username so staff can verify you.');
      return;
    }
    setBusy(true);
    const res = await submitServerClaim({
      serverId,
      discordLink: link,
      message: message.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Claim request sent. ERLC staff will review it.');
    onOpenChange(false);
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request ownership — {serverName}</DialogTitle>
          <DialogDescription>
            This server is not claimed yet. Verified staff here can ask ERLC Directory staff to assign you as the
            listing owner. Include a Discord profile link, invite, or username so we can confirm you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="claim-discord">Your Discord (link, invite, or username)</Label>
            <Input
              id="claim-discord"
              value={discordLink}
              onChange={(e) => setDiscordLink(e.target.value)}
              placeholder="https://discord.com/users/… or discord.gg/… or yourname"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-msg">Optional note to staff</Label>
            <Textarea
              id="claim-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Anything that helps us verify ownership…"
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Sending…' : 'Submit request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
