import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { isModerationReportsSchemaMissingError } from '@/lib/moderationReportsErrors';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'review' | 'message';
  reviewId?: string | null;
  messageId?: string | null;
  conversationId?: string | null;
};

export function SubmitReportDialog({
  open,
  onOpenChange,
  kind,
  reviewId,
  messageId,
  conversationId,
}: Props) {
  const { profile } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const t = reason.trim();
    if (t.length < 3) {
      toast.error('Please describe the issue (at least a few words).');
      return;
    }
    if (!profile?.id) {
      toast.error('Sign in to submit a report.');
      return;
    }
    if (kind === 'review' && !reviewId) {
      toast.error('Missing review reference.');
      return;
    }
    if (kind === 'message' && !messageId) {
      toast.error('Missing message reference.');
      return;
    }

    setSubmitting(true);
    const row: Record<string, unknown> = {
      reporter_profile_id: profile.id,
      kind,
      reason: t.slice(0, 2000),
      status: 'open',
    };
    if (kind === 'review') row.review_id = reviewId;
    if (kind === 'message') {
      row.message_id = messageId;
      if (conversationId) row.conversation_id = conversationId;
    }

    const { error } = await supabase.from('moderation_reports').insert(row as never);
    setSubmitting(false);
    if (error) {
      const msg = error.message ?? '';
      toast.error(
        isModerationReportsSchemaMissingError(msg)
          ? 'Reporting isn’t enabled on this database yet. In Supabase → SQL Editor, paste the full contents of supabase/migrations/20260530120000_staff_warnings_reports.sql (all SQL from the file — includes is_staff). If you see is_site_owner errors, run older migrations first.'
          : msg,
      );
      return;
    }
    toast.success('Report sent. Staff will review it.');
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-white/12 bg-background">
        <DialogHeader>
          <DialogTitle>Report {kind === 'review' ? 'review' : 'message'}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Describe what violates guidelines. Reports are read by directory staff only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="report-reason">Details</Label>
          <Textarea
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            rows={4}
            className="rounded-xl border-white/12 bg-white/[0.04] resize-none"
            placeholder="Harassment, spam, impersonation, etc."
          />
          <p className="text-[11px] text-muted-foreground text-right tabular-nums">{reason.length}/2000</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
