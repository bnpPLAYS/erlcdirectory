import { useEffect, useState } from 'react';
import { UserPlus, Check, X, Clock, MessageSquare, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { filterPlaintext } from '@/lib/chatFilter';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { devWarn, publicErrorMessage } from '@/lib/clientErrorHandling';

type RequestRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

interface Props {
  targetProfileId: string;
  targetName?: string | null;
  className?: string;
}

const ConnectButton = ({ targetProfileId, targetName, className }: Props) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');

  const myId = profile?.id;

  const load = async () => {
    if (!myId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Pull the most recent active request between the two profiles.
    // Use limit(1) instead of maybeSingle() so historical rows don't break the query.
    const { data } = await supabase
      .from('connection_requests')
      .select('id, sender_id, receiver_id, status, created_at')
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${targetProfileId}),and(sender_id.eq.${targetProfileId},receiver_id.eq.${myId})`,
      )
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1);
    setRequest(((data && data[0]) as RequestRow) || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [myId, targetProfileId]);

  if (!profile || !myId || myId === targetProfileId) return null;

  const sendRequest = async () => {
    setBusy(true);
    // Clean up any historical declined/cancelled rows so the insert is fresh.
    await supabase
      .from('connection_requests')
      .delete()
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${targetProfileId}),and(sender_id.eq.${targetProfileId},receiver_id.eq.${myId})`,
      )
      .in('status', ['declined', 'cancelled']);

    const msgF = filterPlaintext(message.trim());
    if (msgF.blockedHits) toast.info('Note wording was adjusted to meet community guidelines.');
    const { data, error } = await supabase
      .from('connection_requests')
      .insert({
        sender_id: myId,
        receiver_id: targetProfileId,
        message: msgF.text || null,
      })
      .select('id, sender_id, receiver_id, status')
      .single();
    setBusy(false);
    if (error) {
      devWarn('[ConnectButton] insert failed', error);
      const msg = error.message || '';
      if (msg.includes('is_my_profile') || msg.includes('are_connected')) {
        toast.error(
          'Could not send your request right now. The directory needs a quick database update—try again after your host applies the latest migrations.',
        );
      } else {
        toast.error(publicErrorMessage('Could not send your request.', error));
      }
      return;
    }
    setRequest(data as RequestRow);
    setDialogOpen(false);
    setMessage('');
    toast.success('Connection request sent');
  };

  const cancelRequest = async () => {
    if (!request) return;
    setBusy(true);
    const { error } = await supabase
      .from('connection_requests')
      .delete()
      .eq('id', request.id);
    setBusy(false);
    if (error) {
      toast.error('Could not cancel');
      return;
    }
    setRequest(null);
    toast.success('Request cancelled');
  };

  const respond = async (accept: boolean) => {
    if (!request) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('connection_requests')
      .update({
        status: accept ? 'accepted' : 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('id', request.id)
      .select('id, sender_id, receiver_id, status')
      .single();
    setBusy(false);
    if (error) {
      toast.error('Could not respond');
      return;
    }
    setRequest((data as RequestRow) || null);
    toast.success(accept ? 'Connection accepted' : 'Request declined');
    if (!accept) setRequest(null);
  };

  const connectBtnClass = cn(
    'rounded-full border-white/20 bg-white/[0.05] hover:bg-white/[0.1] text-foreground',
    className,
  );

  if (loading) {
    return (
      <Button size="sm" disabled variant="outline" className={connectBtnClass}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  // Already connected
  if (request?.status === 'accepted') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Button size="sm" variant="outline" disabled className="gap-2 rounded-full border-white/20 opacity-90">
          <UserCheck className="h-4 w-4" /> Connected
        </Button>
        <Link to={`/messages?with=${targetProfileId}`}>
          <Button size="sm" variant="outline" className="gap-2 rounded-full border-white/20">
            <MessageSquare className="h-4 w-4" /> Message
          </Button>
        </Link>
      </div>
    );
  }

  // I sent a pending request
  if (request?.status === 'pending' && request.sender_id === myId) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={cancelRequest}
        disabled={busy}
        className={cn('gap-2 rounded-full border-white/20', className)}
      >
        <Clock className="h-4 w-4" /> Request sent — Cancel
      </Button>
    );
  }

  // They sent me a pending request
  if (request?.status === 'pending' && request.receiver_id === myId) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Button size="sm" onClick={() => respond(true)} disabled={busy} className="gap-2 rounded-full">
          <Check className="h-4 w-4" /> Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => respond(false)}
          disabled={busy}
          className="gap-2 rounded-full border-white/20"
        >
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    );
  }

  // No relationship → can request
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)} className={cn('gap-2', connectBtnClass)}>
        <UserPlus className="h-4 w-4" /> Connect
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="pt-12 sm:rounded-2xl max-w-md border border-white/12 bg-[hsl(240_6%_9%/0.97)] text-foreground shadow-2xl shadow-black/50 backdrop-blur-xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-semibold tracking-tight pr-2">
              Connect with {targetName || 'this member'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              They&apos;ll see your request on their Connections page. After they accept, you can message each other
              from Messages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="connect-note" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Note (optional)
            </Label>
            <Textarea
              id="connect-note"
              value={message}
              maxLength={300}
              rows={4}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce yourself or say why you’re reaching out…"
              className="resize-none rounded-xl border-white/12 bg-white/[0.04] min-h-[100px]"
            />
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">{message.length}/300</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-white/20"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={sendRequest} disabled={busy} className="gap-2 rounded-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConnectButton;
