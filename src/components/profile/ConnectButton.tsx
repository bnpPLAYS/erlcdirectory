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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { filterPlaintext } from '@/lib/chatFilter';
import { Link } from 'react-router-dom';

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
      console.error('Connect request failed', error);
      toast.error(error.message || 'Could not send request');
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

  if (loading) {
    return (
      <Button size="sm" disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  // Already connected
  if (request?.status === 'accepted') {
    return (
      <div className={`flex gap-2 ${className || ''}`}>
        <Button size="sm" variant="outline" disabled className="gap-2">
          <UserCheck className="h-4 w-4" /> Connected
        </Button>
        <Link to={`/messages?user=${targetProfileId}`}>
          <Button size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Message
          </Button>
        </Link>
      </div>
    );
  }

  // I sent a pending request
  if (request?.status === 'pending' && request.sender_id === myId) {
    return (
      <Button size="sm" variant="outline" onClick={cancelRequest} disabled={busy} className={`gap-2 ${className || ''}`}>
        <Clock className="h-4 w-4" /> Request sent — Cancel
      </Button>
    );
  }

  // They sent me a pending request
  if (request?.status === 'pending' && request.receiver_id === myId) {
    return (
      <div className={`flex gap-2 ${className || ''}`}>
        <Button size="sm" onClick={() => respond(true)} disabled={busy} className="gap-2">
          <Check className="h-4 w-4" /> Accept
        </Button>
        <Button size="sm" variant="outline" onClick={() => respond(false)} disabled={busy} className="gap-2">
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    );
  }

  // No relationship → can request
  return (
    <>
      <Button size="sm" onClick={() => setDialogOpen(true)} className={`gap-2 ${className || ''}`}>
        <UserPlus className="h-4 w-4" /> Connect
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-strong border-white/10 bg-card max-w-md text-card-foreground">
          <DialogHeader>
            <DialogTitle>Connect with {targetName || 'this member'}</DialogTitle>
            <DialogDescription>
              They'll see your request in their Connections page. Once they accept, you can send messages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Add a note (optional)
            </label>
            <Textarea
              value={message}
              maxLength={300}
              rows={4}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hey! I saw your profile and would love to connect about…"
            />
            <p className="text-[11px] text-muted-foreground text-right">{message.length}/300</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={sendRequest} disabled={busy} className="gap-2">
              <UserPlus className="h-4 w-4" /> Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConnectButton;
