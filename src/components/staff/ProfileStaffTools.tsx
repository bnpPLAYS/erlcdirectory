import { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Props = {
  subjectProfileId: string;
  subjectDisplayName: string | null;
};

export function ProfileStaffTools({ subjectProfileId, subjectDisplayName }: Props) {
  const { profile } = useAuth();
  const [warningBody, setWarningBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const issueWarning = async () => {
    const body = warningBody.trim();
    if (body.length < 4) {
      toast.error('Enter a short warning note (what they should fix).');
      return;
    }
    if (!profile?.id) return;
    setSubmitting(true);
    const { error } = await supabase.from('profile_warnings').insert({
      subject_profile_id: subjectProfileId,
      issued_by_profile_id: profile.id,
      body: body.slice(0, 2000),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Warning recorded.');
    setWarningBody('');
  };

  return (
    <Card className="border-amber-500/40 bg-amber-950/15 liquid-edge">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-amber-100">
          <Shield className="h-5 w-5 shrink-0 text-amber-400" />
          <h3 className="font-semibold">Staff moderation</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          You&apos;re viewing{' '}
          <strong className="text-foreground">{subjectDisplayName || 'this member'}</strong>. Issue an official warning
          (visible to them on their profile), handle reports in the staff panel, or remove inappropriate reviews below.
        </p>
        <div className="space-y-2">
          <Label htmlFor="staff-warning" className="text-xs uppercase tracking-wide text-amber-200/80">
            Issue warning
          </Label>
          <Textarea
            id="staff-warning"
            value={warningBody}
            onChange={(e) => setWarningBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Explain the concern or rule reminder…"
            className="rounded-xl border-amber-500/25 bg-black/30 resize-none"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-2 border-amber-500/30"
            disabled={submitting}
            onClick={() => void issueWarning()}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Save warning
          </Button>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full border-amber-500/35">
          <Link to="/staff?tab=reports">Open reports queue</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
