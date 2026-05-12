import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatTimeAgo } from '@/lib/mockData';
import { filterPlaintext } from '@/lib/chatFilter';
import { toast } from 'sonner';
import { profilePath } from '@/lib/profilePath';

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  profiles: {
    display_name: string | null;
    discord_username: string | null;
    discord_avatar: string | null;
  } | null;
};

const MAX_LEN = 2000;

type Props = {
  postId: string;
  /** Only `approved` posts accept comments (matches RLS). */
  postStatus: string;
};

export function PostComments({ postId, postStatus }: Props) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const approved = postStatus === 'approved';

  const load = useCallback(async () => {
    if (!approved) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('post_comments')
      .select('id, content, created_at, author_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error(error.message);
      setComments([]);
      setLoading(false);
      return;
    }
    const base = rows || [];
    const authorIds = [...new Set(base.map((r) => r.author_id))];
    const profMap = new Map<string, { display_name: string | null; discord_username: string | null; discord_avatar: string | null }>();
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, discord_username, discord_avatar')
        .in('id', authorIds);
      (profs || []).forEach((p) =>
        profMap.set(p.id, {
          display_name: p.display_name,
          discord_username: p.discord_username,
          discord_avatar: p.discord_avatar,
        }),
      );
    }
    setComments(
      base.map((r) => ({
        ...r,
        profiles: profMap.get(r.author_id) ?? null,
      })),
    );
    setLoading(false);
  }, [postId, approved]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!approved) return;
    const channel = supabase
      .channel(`post-comments-${postId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [postId, approved, load]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const send = async () => {
    if (!profile || !approved || !text.trim()) return;
    const { text: t, blockedHits } = filterPlaintext(text.trim());
    if (!t) return;
    if (t.length > MAX_LEN) {
      toast.error(`Comments are limited to ${MAX_LEN} characters.`);
      return;
    }
    setSending(true);
    const { error } = await supabase.from('post_comments').insert({
      post_id: postId,
      author_id: profile.id,
      content: t,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (blockedHits) toast.info('Wording was adjusted to meet community guidelines.');
    setText('');
    void load();
  };

  const remove = async (id: string) => {
    if (!profile) return;
    if (!confirm('Delete this comment?')) return;
    const { error } = await supabase.from('post_comments').delete().eq('id', id).eq('author_id', profile.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  };

  if (!approved) {
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs text-muted-foreground">
        Comments unlock after this post is approved by staff.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.03]">
        <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        <span className="text-sm font-medium text-foreground">Comments</span>
        {!loading && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>

      <div ref={listRef} className="max-h-72 overflow-y-auto px-3 py-2 space-y-2.5">
        {loading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No comments yet — start the thread.</p>
        ) : (
          comments.map((c) => {
            const label = (c.profiles?.display_name || c.profiles?.discord_username || 'Member').trim();
            return (
              <div key={c.id} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                <div className="flex items-start gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={c.profiles?.discord_avatar || undefined} />
                    <AvatarFallback className="text-[10px]">{label[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={profilePath({
                          id: c.author_id,
                          discord_username: c.profiles?.discord_username ?? null,
                        })}
                        className="text-xs font-medium text-foreground hover:underline truncate"
                      >
                        {label}
                      </Link>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {formatTimeAgo(c.created_at)}
                      </span>
                      {profile?.id === c.author_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive -mr-1"
                          title="Delete your comment"
                          onClick={() => void remove(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-1">{c.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {user ? (
        <div className="p-3 border-t border-white/10 space-y-2 bg-black/15">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            maxLength={MAX_LEN}
            className="resize-none min-h-[4.5rem] border-white/12 bg-background/80 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground tabular-nums">{text.length}/{MAX_LEN}</span>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={!text.trim() || sending}
              onClick={() => void send()}
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Posting…' : 'Post comment'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2.5 border-t border-white/10 text-xs text-muted-foreground text-center">
          <Link to="/auth" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>{' '}
          to comment.
        </div>
      )}
    </div>
  );
}
