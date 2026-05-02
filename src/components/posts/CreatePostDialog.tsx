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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const TYPES = [
  { value: 'hiring', label: 'Hiring' },
  { value: 'looking', label: 'Looking for work' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'discussion', label: 'Discussion' },
];

const CreatePostDialog = ({ onCreated }: { onCreated?: () => void }) => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('hiring');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!profile) return;
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
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not create opening', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Posted!' });
    setOpen(false);
    setTitle('');
    setContent('');
    setType('hiring');
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New opening
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle>Create an opening</DialogTitle>
          <DialogDescription>
            Share a hiring post, an application, or a community update.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hiring senior moderator for night shift"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What you're looking for, requirements, how to apply…"
              rows={6}
              maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Posting…' : 'Post opening'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;
