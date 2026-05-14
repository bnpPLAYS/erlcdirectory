import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { callModerationFn } from '@/lib/callModerationFn';
import { isModerationReportsSchemaMissingError } from '@/lib/moderationReportsErrors';

const AREAS = [
  { id: 'ui', label: 'Layout / buttons / visuals' },
  { id: 'auth', label: 'Sign-in or session' },
  { id: 'data', label: 'Wrong or missing data' },
  { id: 'perf', label: 'Slow or freezing' },
  { id: 'other', label: 'Something else' },
] as const;

type AreaId = (typeof AREAS)[number]['id'];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BugReportDialog({ open, onOpenChange }: Props) {
  const { pathname, search } = useLocation();
  const { profile, session } = useAuth();
  const [area, setArea] = useState<AreaId>('ui');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setDetails('');
      setArea('ui');
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    const body = details.trim();
    if (body.length < 12) {
      toast.error('Write at least 12 characters — what broke and what you expected.');
      return;
    }
    if (!profile?.id) {
      toast.error('Log in to send a bug report.');
      return;
    }
    if (!session?.access_token) {
      toast.error('Session expired — sign in again.');
      return;
    }

    const areaLabel = AREAS.find((a) => a.id === area)?.label ?? area;
    const pagePath = `${pathname}${search || ''}`.slice(0, 2000);
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 800) : '';

    setBusy(true);
    const r = await callModerationFn('submit-report', {
      kind: 'bug',
      report_category: 'bug',
      reason: `[${areaLabel}] ${body}`,
      page_path: pagePath,
      user_agent: userAgent,
    });
    setBusy(false);
    if (!r.ok) {
      toast.error(
        isModerationReportsSchemaMissingError(r.error)
          ? 'Reporting is not wired up on this database yet (run migrations including bug reports).'
          : r.error,
      );
      return;
    }
    toast.success('Sent. Staff will see it under Reports.');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-white/12 bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 opacity-80" aria-hidden />
            Report a bug
          </DialogTitle>
          <DialogDescription>
            This goes to the staff queue (same as other reports). Include steps to reproduce if you can.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground font-mono break-all">
            Page: {pathname}
            {search ? search : ''}
          </div>
          <div className="space-y-2">
            <Label>Area</Label>
            <Select value={area} onValueChange={(v) => setArea(v as AreaId)}>
              <SelectTrigger className="border-white/12 bg-background/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bug-details">What happened</Label>
            <Textarea
              id="bug-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Example: clicked Save on Edit profile, toast said OK but refresh lost my bio."
              className="resize-none border-white/12 bg-background/80 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">{details.trim().length}/2000 (min 12)</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Sending…' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
