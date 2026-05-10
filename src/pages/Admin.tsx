import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Trash2, CheckCircle2, Crown, Search, UserPlus, X, MessageSquare, Check, Ban } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';

type StaffAccess = { canModerate: boolean; isSiteOwner: boolean };

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<StaffAccess | null>(null);

  const [profiles, setProfiles] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [newStaffQuery, setNewStaffQuery] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    if (!user) {
      setAccess({ canModerate: false, isSiteOwner: false });
      return;
    }
    let cancelled = false;
    setAccess(null);
    void (async () => {
      const [{ data: prof }, { data: roleRow }] = await Promise.all([
        supabase.from('profiles').select('discord_username').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'admin').maybeSingle(),
      ]);
      if (cancelled) return;
      const owner = isSiteOwnerDiscordUsername(prof?.discord_username ?? null);
      setAccess({ canModerate: owner || !!roleRow, isSiteOwner: owner });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = async () => {
    const [p, s, po, st] = await Promise.all([
      supabase.from('profiles').select('id, user_id, display_name, discord_username, discord_avatar, is_verified, is_featured').order('created_at', { ascending: false }).limit(200),
      supabase.from('servers').select('id, name, icon, member_count, guild_id, is_verified').order('created_at', { ascending: false }).limit(200),
      supabase.from('posts').select('id, title, type, author_id, created_at, status').order('created_at', { ascending: false }).limit(200),
      supabase.from('user_roles').select('id, user_id, role').eq('role', 'admin'),
    ]);
    setProfiles(p.data || []);
    setServers(s.data || []);
    setPosts(po.data || []);
    // Hydrate staff with profile names
    const ids = (st.data || []).map((r) => r.user_id);
    if (ids.length) {
      const { data: sp } = await supabase.from('profiles').select('id, user_id, display_name, discord_username, discord_avatar').in('user_id', ids);
      setStaff((st.data || []).map((r) => ({ ...r, profile: sp?.find((x) => x.user_id === r.user_id) })));
    } else setStaff([]);
  };

  useEffect(() => {
    if (access?.canModerate) refresh();
  }, [access?.canModerate]);

  if (authLoading || access === null) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading…</div></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!access.canModerate) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-md text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Staff only</h1>
          <p className="text-muted-foreground">You don't have access to this area.</p>
        </div>
      </div>
    );
  }

  const toggleVerified = async (p: any) => {
    let { error } = await supabase.rpc('site_owner_set_profile_flags', {
      p_profile_id: p.id,
      p_is_verified: !p.is_verified,
      p_is_featured: !!p.is_featured,
    });
    const msg = error?.message ?? '';
    const rpcUnavailable =
      !!error &&
      (/Could not find the function|schema cache|PGRST202|42883/i.test(msg) ||
        /site_owner_set_profile_flags/i.test(msg));
    if (rpcUnavailable) {
      ({ error } = await supabase.from('profiles').update({ is_verified: !p.is_verified }).eq('id', p.id));
    }
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_verified: !p.is_verified } : x)));
  };
  const toggleFeatured = async (p: any) => {
    let { error } = await supabase.rpc('site_owner_set_profile_flags', {
      p_profile_id: p.id,
      p_is_verified: !!p.is_verified,
      p_is_featured: !p.is_featured,
    });
    const msg = error?.message ?? '';
    const rpcUnavailable =
      !!error &&
      (/Could not find the function|schema cache|PGRST202|42883/i.test(msg) ||
        /site_owner_set_profile_flags/i.test(msg));
    if (rpcUnavailable) {
      ({ error } = await supabase.from('profiles').update({ is_featured: !p.is_featured }).eq('id', p.id));
    }
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_featured: !p.is_featured } : x)));
  };

  const toggleServerVerified = async (s: any) => {
    let { error } = await supabase.rpc('site_owner_set_server_verified', {
      p_server_id: s.id,
      p_is_verified: !s.is_verified,
    });
    const msg = error?.message ?? '';
    const rpcUnavailable =
      !!error &&
      (/Could not find the function|schema cache|PGRST202|42883/i.test(msg) ||
        /site_owner_set_server_verified/i.test(msg));
    if (rpcUnavailable) {
      ({ error } = await supabase.from('servers').update({ is_verified: !s.is_verified }).eq('id', s.id));
    }
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setServers((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_verified: !s.is_verified } : x)));
  };
  const removeProfile = async (p: any) => {
    if (!confirm(`Delete account ${p.display_name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('profiles').delete().eq('id', p.id);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setProfiles((prev) => prev.filter((x) => x.id !== p.id));
  };
  const removeServer = async (s: any) => {
    if (!confirm(`Delete server ${s.name}?`)) return;
    const { error } = await supabase.from('servers').delete().eq('id', s.id);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setServers((prev) => prev.filter((x) => x.id !== s.id));
  };
  const removePost = async (p: any) => {
    if (!confirm(`Delete opening "${p.title}"?`)) return;
    const { error } = await supabase.from('posts').delete().eq('id', p.id);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
  };

  const setPostStatus = async (p: any, status: 'pending' | 'approved' | 'rejected') => {
    let { error } = await supabase.rpc('site_owner_set_post_status', {
      p_post_id: p.id,
      p_status: status,
    });
    const msg = error?.message ?? '';
    const code = (error as { code?: string } | null)?.code;
    const rpcUnavailable =
      !!error &&
      (code === 'PGRST202' ||
        /Could not find the function|schema cache|PGRST202|42883/i.test(msg) ||
        /site_owner_set_post_status/i.test(msg));
    if (rpcUnavailable) {
      ({ error } = await supabase.from('posts').update({ status }).eq('id', p.id));
    }
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status } : x)));
    toast({ title: status === 'approved' ? 'Post approved' : status === 'rejected' ? 'Post rejected' : 'Updated' });
  };
  const addStaff = async (target: any) => {
    let { error } = await supabase.rpc('site_owner_grant_admin_role', {
      p_target_user_id: target.user_id,
    });
    const msg = error?.message ?? '';
    const code = (error as { code?: string } | null)?.code;
    const rpcUnavailable =
      !!error &&
      (code === 'PGRST202' ||
        /Could not find the function|schema cache|PGRST202|42883/i.test(msg) ||
        /site_owner_grant_admin_role/i.test(msg));
    if (rpcUnavailable) {
      ({ error } = await supabase.from('user_roles').insert({
        user_id: target.user_id,
        role: 'admin',
      }));
      const dup =
        !!error &&
        (/duplicate key|unique constraint|23505/i.test(error.message ?? '') ||
          /already exists/i.test(error.message ?? ''));
      if (dup) error = null;
    }
    if (error) return toast({ title: error.message, variant: 'destructive' });
    toast({ title: `${target.display_name || target.discord_username || 'Member'} is now staff` });
    setNewStaffQuery('');
    refresh();
  };
  const sendDiscordBroadcast = async () => {
    const msg = broadcastText.trim();
    if (!msg) return toast({ title: 'Enter a message', variant: 'destructive' });
    if (!confirm(`Send this update as a Discord DM to everyone who opted into website updates?`)) return;
    setBroadcasting(true);
    const { data, error } = await supabase.functions.invoke('website-dm-broadcast', { body: { message: msg } });
    setBroadcasting(false);
    if (error) return toast({ title: error.message || 'Broadcast failed', variant: 'destructive' });
    toast({
      title: `Delivered to ${(data as { sent?: number })?.sent ?? 0} of ${(data as { attempted?: number })?.attempted ?? 0} subscribers`,
    });
    setBroadcastText('');
  };

  const removeStaff = async (row: any) => {
    if (row.user_id === user.id) return toast({ title: "You can't remove yourself.", variant: 'destructive' });
    if (!confirm(`Remove staff access from ${row.profile?.display_name || 'this user'}?`)) return;
    let { error } = await supabase.rpc('site_owner_revoke_admin_role', {
      p_target_user_id: row.user_id,
    });
    const msg = error?.message ?? '';
    const code = (error as { code?: string } | null)?.code;
    const rpcUnavailable =
      !!error &&
      (code === 'PGRST202' ||
        /Could not find the function|schema cache|PGRST202|42883/i.test(msg) ||
        /site_owner_revoke_admin_role/i.test(msg));
    if (rpcUnavailable) {
      ({ error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', row.user_id)
        .eq('role', 'admin'));
    }
    if (error) return toast({ title: error.message, variant: 'destructive' });
    refresh();
  };

  const filter = (list: any[], keys: string[]) =>
    !q ? list : list.filter((x) => keys.some((k) => (x[k] || '').toString().toLowerCase().includes(q.toLowerCase())));

  const newStaffMatches = newStaffQuery.length >= 2
    ? profiles.filter((p) =>
        !staff.some((s) => s.user_id === p.user_id) &&
        ((p.display_name || '').toLowerCase().includes(newStaffQuery.toLowerCase()) ||
         (p.discord_username || '').toLowerCase().includes(newStaffQuery.toLowerCase()))
      ).slice(0, 6)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center"><Shield className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">Staff panel</h1>
            <p className="text-sm text-muted-foreground">Restricted to authorized staff.</p>
          </div>
        </div>

        <Tabs key={access.isSiteOwner ? 'staff-full' : 'staff-mod'} defaultValue={access.isSiteOwner ? 'members' : 'openings'}>
          <TabsList className="mb-4 flex flex-wrap">
            {access.isSiteOwner && (
              <>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="servers">Servers</TabsTrigger>
              </>
            )}
            <TabsTrigger value="openings">Posts</TabsTrigger>
            {access.isSiteOwner && (
              <>
                <TabsTrigger value="staff">Staff</TabsTrigger>
                <TabsTrigger value="discord" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Discord
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
          </div>

          {access.isSiteOwner && (
          <TabsContent value="members" className="space-y-2">
            {filter(profiles, ['display_name', 'discord_username']).map((p) => (
              <Card key={p.id}><CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9"><AvatarImage src={p.discord_avatar || undefined} /><AvatarFallback>{p.display_name?.[0] || '?'}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">{p.display_name || 'Member'}
                    {p.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-verified" />}
                    {p.is_featured && <Crown className="h-3.5 w-3.5 text-featured" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">@{p.discord_username || '—'}</p>
                </div>
                <Button size="sm" variant={p.is_verified ? 'default' : 'outline'} onClick={() => toggleVerified(p)} className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />{p.is_verified ? 'Verified' : 'Verify'}
                </Button>
                <Button size="sm" variant={p.is_featured ? 'default' : 'outline'} onClick={() => toggleFeatured(p)} className="gap-1">
                  <Crown className="h-3.5 w-3.5" />{p.is_featured ? 'Pinned' : 'Pin'}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => removeProfile(p)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </CardContent></Card>
            ))}
          </TabsContent>
          )}

          {access.isSiteOwner && (
          <TabsContent value="servers" className="space-y-2">
            {filter(servers, ['name']).map((s) => (
              <Card key={s.id}><CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9 rounded-md"><AvatarImage src={s.icon || undefined} /><AvatarFallback className="rounded-md">{s.name?.[0]}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {s.name}
                    {s.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-verified shrink-0" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.member_count || 0} members</p>
                </div>
                <Button size="sm" variant={s.is_verified ? 'default' : 'outline'} onClick={() => toggleServerVerified(s)} className="gap-1 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />{s.is_verified ? 'Verified' : 'Verify'}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => removeServer(s)} className="text-destructive shrink-0"><Trash2 className="h-4 w-4" /></Button>
              </CardContent></Card>
            ))}
          </TabsContent>
          )}

          <TabsContent value="openings" className="space-y-2">
            {filter(posts, ['title']).map((p) => (
              <Card key={p.id}><CardContent className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="capitalize">{p.type}</Badge>
                  <Badge
                    variant={p.status === 'approved' ? 'secondary' : p.status === 'rejected' ? 'destructive' : 'outline'}
                    className="capitalize text-[10px]"
                  >
                    {p.status || 'pending'}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                  {p.status !== 'approved' && (
                    <Button size="sm" variant="secondary" className="gap-1" onClick={() => void setPostStatus(p, 'approved')}>
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                  )}
                  {p.status !== 'rejected' && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => void setPostStatus(p, 'rejected')}>
                      <Ban className="h-3.5 w-3.5" /> Reject
                    </Button>
                  )}
                  {p.status !== 'pending' && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => void setPostStatus(p, 'pending')}>
                      Pending
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => removePost(p)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          {access.isSiteOwner && (
          <TabsContent value="discord" className="space-y-3">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" /> Website update (Discord DM)
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sends a direct message from the directory bot to every profile with <strong>website updates</strong>{' '}
                    enabled. Requires <code className="text-xs bg-white/10 px-1 rounded">DISCORD_BOT_TOKEN</code> and the
                    bot to share a server with each recipient.
                  </p>
                </div>
                <Textarea
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Short announcement (max 1800 characters)…"
                  rows={5}
                  maxLength={1800}
                  className="rounded-xl border-white/12 bg-white/[0.04] resize-none"
                />
                <p className="text-xs text-muted-foreground text-right tabular-nums">{broadcastText.length}/1800</p>
                <Button type="button" disabled={broadcasting || !broadcastText.trim()} onClick={() => void sendDiscordBroadcast()}>
                  {broadcasting ? 'Sending…' : 'Send to opted-in users'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {access.isSiteOwner && (
          <TabsContent value="staff" className="space-y-3">
            <Card><CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add a staff member</p>
              <Input value={newStaffQuery} onChange={(e) => setNewStaffQuery(e.target.value)} placeholder="Search by name or Discord username…" />
              {newStaffMatches.length > 0 && (
                <div className="space-y-1">
                  {newStaffMatches.map((p) => (
                    <button key={p.id} onClick={() => addStaff(p)} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 text-left">
                      <Avatar className="h-8 w-8"><AvatarImage src={p.discord_avatar || undefined} /><AvatarFallback>{p.display_name?.[0]}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{p.display_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">@{p.discord_username}</p>
                      </div>
                      <Badge variant="outline">Add</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent></Card>

            <p className="text-xs uppercase tracking-wide text-muted-foreground pt-2">Current staff</p>
            {staff.map((row) => (
              <Card key={row.id}><CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9"><AvatarImage src={row.profile?.discord_avatar || undefined} /><AvatarFallback>{row.profile?.display_name?.[0] || '?'}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {row.profile?.display_name || row.profile?.discord_username || 'Staff (profile not linked)'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.profile?.discord_username ? `@${row.profile.discord_username}` : '—'}
                  </p>
                </div>
                <Badge>admin</Badge>
                <Button size="icon" variant="ghost" onClick={() => removeStaff(row)} className="text-destructive"><X className="h-4 w-4" /></Button>
              </CardContent></Card>
            ))}
          </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
