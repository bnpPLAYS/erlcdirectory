import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { submitServerClaim } from '@/lib/callServerClaim';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  serverName: string;
  /** Defaults to the signed-in user's Discord profile URL. */
  defaultDiscordLink?: string;
  onSubmitted?: () => void;
};

export function ServerClaimDialog({
  open,
  onOpenChange,
  serverId,
  serverName,
  defaultDiscordLink,
  onSubmitted,
}: Props) {
  const [discordLink, setDiscordLink] = useState(defaultDiscordLink ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setMessage('');
      setBusy(false);
      setDiscordLink(defaultDiscordLink ?? '');
    } else {
      setDiscordLink(defaultDiscordLink ?? '');
    }
  }, [open, defaultDiscordLink]);

  const submit = async () => {
    const link = discordLink.trim();
    if (!link) {
      toast.error('Add your Discord profile link so staff can DM you for verification.');
      return;
    }
    const body = message.trim();
    if (body.length > 0 && body.length < 8) {
      toast.error('Write at least 8 characters of context, or leave the note empty.');
      return;
    }
    setBusy(true);
    const r = await submitServerClaim({ serverId, discordLink: link, message: body });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success('Sent. Staff will review and reach out on Discord.');
    onSubmitted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-white/12 bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 opacity-80" aria-hidden />
            Claim {serverName}
          </DialogTitle>
          <DialogDescription>
            Only verified staff of this server can submit a claim. Our team will check ownership on
            Discord and either approve or deny.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="claim-discord-link">Your Discord profile or community link</Label>
            <Input
              id="claim-discord-link"
              value={discordLink}
              onChange={(e) => setDiscordLink(e.target.value)}
              placeholder="https://discord.com/users/123… or https://discord.gg/yourcode"
              className="border-white/12 bg-background/80"
              maxLength={400}
            />
            <p className="text-[11px] text-muted-foreground">
              We use this to DM you for confirmation. It is only visible to staff.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="claim-note">Anything we should know (optional)</Label>
            <Textarea
              id="claim-note"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Example: I'm the founder and current admin. Server founded 2024-08-01."
              className="resize-none border-white/12 bg-background/80 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">{message.trim().length}/2000</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Sending…' : 'Submit claim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
