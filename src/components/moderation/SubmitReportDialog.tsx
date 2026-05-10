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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { isModerationReportsSchemaMissingError } from '@/lib/moderationReportsErrors';
import { REPORT_CATEGORY_OPTIONS, type ReportCategoryId } from '@/lib/reportCategories';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'review' | 'message' | 'server';
  reviewId?: string | null;
  messageId?: string | null;
  conversationId?: string | null;
  serverId?: string | null;
};

export function SubmitReportDialog({
  open,
  onOpenChange,
  kind,
  reviewId,
  messageId,
  conversationId,
  serverId,
}: Props) {
  const { profile, session } = useAuth();
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<ReportCategoryId>('harassment');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setCategory('harassment');
      setSubmitting(false);
    }
  }, [open]);

  const title =
    kind === 'review' ? 'Report review' : kind === 'message' ? 'Report message' : 'Report server';

  const submit = async () => {
    const t = reason.trim();
    const minLen = category === 'other' ? 8 : 3;
    if (t.length < minLen) {
      toast.error(
        category === 'other'
          ? 'Please describe the issue in more detail (at least a sentence).'
          : 'Please describe the issue (at least a few words).',
      );
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
    if (kind === 'server' && !serverId) {
      toast.error('Missing server reference.');
      return;
    }

    if (!session?.access_token) {
      toast.error('Your session expired. Sign in again.');
      return;
    }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      kind,
      report_category: category,
      reason: t.slice(0, 2000),
    };
    if (kind === 'review') payload.review_id = reviewId;
    if (kind === 'message') {
      payload.message_id = messageId;
      if (conversationId) payload.conversation_id = conversationId;
    }
    if (kind === 'server') payload.server_id = serverId;

    let msg: string | null = null;
    try {
      const res = await fetch('/api/submit-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        msg = data.error || `Request failed (${res.status})`;
      }
    } catch {
      msg = 'Network error submitting report.';
    }
    setSubmitting(false);
    if (msg) {
      toast.error(
        isModerationReportsSchemaMissingError(msg)
          ? 'Reporting isn’t enabled on this database yet. Run the migrations for moderation reports (see Docs → Reporting).'
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose a category and add details. Reports are read by directory staff only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">What kind of issue is this?</Label>
            <RadioGroup
              value={category}
              onValueChange={(v) => setCategory(v as ReportCategoryId)}
              className="gap-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 max-h-52 overflow-y-auto"
            >
              {REPORT_CATEGORY_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.05]"
                >
                  <RadioGroupItem value={opt.id} id={`report-cat-${opt.id}`} className="mt-0.5" />
                  <span className="text-sm leading-snug text-foreground/90">{opt.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-reason">
              {category === 'other' ? 'Explain what happened' : 'Details'}
            </Label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              rows={category === 'other' ? 5 : 4}
              className="rounded-xl border-white/12 bg-white/[0.04] resize-none"
              placeholder={
                category === 'other'
                  ? 'Describe the situation so staff can understand…'
                  : 'Add context (quotes, links, what happened)…'
              }
            />
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">{reason.length}/2000</p>
          </div>
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
