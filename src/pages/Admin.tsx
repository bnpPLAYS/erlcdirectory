import { useEffect, useState, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Shield, Trash2, CheckCircle2, Crown, Search, UserPlus, X, MessageSquare, Check, Ban, AlertTriangle, Bird, Copy, Sparkles, ScrollText } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';
import { callSiteOwnerStaffRole } from '@/lib/callSiteOwnerStaffRole';
import { reportCategoryLabel } from '@/lib/reportCategories';
import { callModerationFn } from '@/lib/callModerationFn';
import {
  canaryStaffStart,
  canaryStaffStatus,
  canaryStaffStop,
} from '@/lib/callCanarySession';

type StaffAccess = { canModerate: boolean; isSiteOwner: boolean };

const Admin = () => {
  const { user, session, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<StaffAccess | null>(null);
  const [searchParams] = useSearchParams();

  const [profiles, setProfiles] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [newStaffQuery, setNewStaffQuery] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [warnForReportId, setWarnForReportId] = useState<string | null>(null);
  const [warnBody, setWarnBody] = useState('');
  const [canaryActive, setCanaryActive] = useState(false);
  const [canaryStartedAt, setCanaryStartedAt] = useState<string | null>(null);
  const [canaryBusy, setCanaryBusy] = useState(false);
  const [canaryPlainCode, setCanaryPlainCode] = useState<string | null>(null);
  const [staffDlg, setStaffDlg] = useState<{
    title: string;
    submit: (reason: string) => Promise<void>;
  } | null>(null);
  const [staffDlgReason, setStaffDlgReason] = useState('');
  const [staffDlgBusy, setStaffDlgBusy] = useState(false);
  const [reportMod, setReportMod] = useState<{
    row: Record<string, unknown>;
    action: 'ban' | 'remove_server';
  } | null>(null);
  const [reportModReason, setReportModReason] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

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

  const loadAuditLogs = useCallback(async () => {
    if (!access?.isSiteOwner) return;
    setAuditLoading(true);
    const { data, error } = await supabase
      .from('staff_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(400);
    setAuditLoading(false);
    if (error) {
      setAuditLogs([]);
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    setAuditLogs(data || []);
  }, [access?.isSiteOwner]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const refresh = async () => {
    const [p, s, po, st, rep] = await Promise.all([
      supabase.from('profiles').select('id, user_id, display_name, discord_username, discord_avatar, is_verified, is_featured, is_pro').order('created_at', { ascending: false }).limit(200),
      supabase.from('servers').select('id, name, icon, member_count, guild_id, is_verified').order('created_at', { ascending: false }).limit(200),
      supabase.from('posts').select('id, title, type, author_id, created_at, status').order('created_at', { ascending: false }).limit(200),
      supabase.from('user_roles').select('id, user_id, role').eq('role', 'admin'),
      supabase
        .from('moderation_reports')
        .select(
          'id, kind, reason, report_category, status, created_at, reporter_profile_id, review_id, message_id, conversation_id, server_id, staff_notes, resolved_at',
        )
        .order('created_at', { ascending: false })
        .limit(100),
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

    if (rep.error) {
      setReports([]);
    } else {
      let rlist = rep.data || [];
      const rids = [...new Set(rlist.map((x: { reporter_profile_id: string }) => x.reporter_profile_id))];
      const reporterMap = new Map<string, string>();
      if (rids.length) {
        const { data: rprofs } = await supabase.from('profiles').select('id, display_name, discord_username').in('id', rids);
        for (const pr of rprofs || []) {
          reporterMap.set(pr.id, (pr.display_name || pr.discord_username || 'Member').trim());
        }
      }

      const serverIds = [...new Set(rlist.map((x: { server_id?: string | null }) => x.server_id).filter(Boolean))] as string[];
      const serverNameById = new Map<string, string>();
      if (serverIds.length) {
        const { data: sv } = await supabase.from('servers').select('id, name').in('id', serverIds);
        for (const s of sv || []) serverNameById.set(s.id, s.name);
      }

      const msgIds = [...new Set(rlist.map((x: { message_id?: string | null }) => x.message_id).filter(Boolean))] as string[];
      const msgExtra = new Map<string, { preview: string; senderLabel: string }>();
      if (msgIds.length) {
        const { data: msgs } = await supabase.from('messages').select('id, content, sender_id').in('id', msgIds);
        const senderIds = [...new Set((msgs || []).map((m) => m.sender_id))];
        const senderLabel = new Map<string, string>();
        if (senderIds.length) {
          const { data: sp } = await supabase
            .from('profiles')
            .select('id, display_name, discord_username')
            .in('id', senderIds);
          for (const p of sp || []) {
            senderLabel.set(p.id, (p.display_name || p.discord_username || 'Member').trim());
          }
        }
        for (const m of msgs || []) {
          const prev = (m.content || '').replace(/\s+/g, ' ').trim().slice(0, 200);
          msgExtra.set(m.id, {
            preview: prev || '(empty message)',
            senderLabel: senderLabel.get(m.sender_id) || 'Unknown',
          });
        }
      }

      setReports(
        rlist.map((row: Record<string, unknown>) => {
          const messageId = row.message_id as string | null | undefined;
          const serverId = row.server_id as string | null | undefined;
          const msgMeta = messageId ? msgExtra.get(messageId) : undefined;
          return {
            ...row,
            reporter_label: reporterMap.get(row.reporter_profile_id as string) || '—',
            server_label: serverId ? serverNameById.get(serverId) || null : null,
            message_preview: msgMeta?.preview,
            message_sender_label: msgMeta?.senderLabel,
          };
        }),
      );
    }
    void loadAuditLogs();
  };

  useEffect(() => {
    if (access?.canModerate) refresh();
  }, [access?.canModerate]);

  const loadCanary = useCallback(async () => {
    if (!access?.canModerate || !session?.access_token) return;
    const r = await canaryStaffStatus(session.access_token);
    if (r.ok) {
      setCanaryActive(r.active);
      setCanaryStartedAt(r.started_at);
    }
  }, [access?.canModerate, session?.access_token]);

  useEffect(() => {
    void loadCanary();
  }, [loadCanary]);

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
  const toggleProOwner = async (p: any) => {
    const next = !p.is_pro;
    const { error } = await supabase
      .from('profiles')
      .update({
        is_pro: next,
        pro_verified_at: next ? new Date().toISOString() : null,
      })
      .eq('id', p.id);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_pro: next } : x)));
    toast({ title: next ? 'Pro granted' : 'Pro removed' });
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
      const proxy = await callSiteOwnerStaffRole('grant', target.user_id);
      if (proxy.error) return toast({ title: proxy.error, variant: 'destructive' });
      toast({ title: `${target.display_name || target.discord_username || 'Member'} is now staff` });
      setNewStaffQuery('');
      refresh();
      return;
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
      const proxy = await callSiteOwnerStaffRole('revoke', row.user_id);
      if (proxy.error) return toast({ title: proxy.error, variant: 'destructive' });
      refresh();
      return;
    }
    if (error) return toast({ title: error.message, variant: 'destructive' });
    refresh();
  };

  const filter = (list: any[], keys: string[]) =>
    !q ? list : list.filter((x) => keys.some((k) => (x[k] || '').toString().toLowerCase().includes(q.toLowerCase())));

  const resolveReport = async (row: any, status: 'resolved' | 'dismissed') => {
    const { error } = await supabase
      .from('moderation_reports')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    toast({ title: 'Report updated' });
    refresh();
  };

  const staffReportAction = async (
    row: any,
    action: string,
    opts?: { warn_body?: string; reason?: string },
  ) => {
    if (!session?.access_token) {
      toast({ title: 'Session expired. Sign in again.', variant: 'destructive' });
      return;
    }
    if (action === 'ban' && !opts?.reason?.trim() && !access?.isSiteOwner) {
      toast({ title: 'Enter a staff reason (10+ characters) before banning.', variant: 'destructive' });
      return;
    }
    if (action === 'remove_server' && !opts?.reason?.trim() && !access?.isSiteOwner) {
      toast({ title: 'Enter a staff reason (10+ characters) before removing the server.', variant: 'destructive' });
      return;
    }
    if (action === 'ban' && !confirm('Ban this member from logging in? Their Discord sign-in will be blocked.')) return;
    if (action === 'delete_message' && !confirm('Delete this message permanently?')) return;
    if (action === 'delete_review' && !confirm('Delete this review permanently?')) return;
    if (action === 'remove_server' && !confirm('Remove this server listing from the directory?')) return;

    const r = await callModerationFn('staff-moderation-action', {
      report_id: row.id,
      action,
      warn_body: opts?.warn_body,
      reason: opts?.reason?.trim() || undefined,
    });
    if (!r.ok) {
      toast({ title: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Action completed' });
    setWarnForReportId(null);
    setWarnBody('');
    setReportMod(null);
    setReportModReason('');
    refresh();
  };

  const startCanarySession = async () => {
    if (!session?.access_token) {
      toast({ title: 'Session expired. Sign in again.', variant: 'destructive' });
      return;
    }
    setCanaryBusy(true);
    const r = await canaryStaffStart(session.access_token);
    setCanaryBusy(false);
    if (!r.ok) return toast({ title: r.error, variant: 'destructive' });
    setCanaryPlainCode(r.test_code);
    toast({ title: 'Canary session started' });
    void loadCanary();
  };

  const stopCanarySession = async () => {
    if (!session?.access_token) return;
    if (!confirm('End the canary session? Testers will lose access immediately.')) return;
    setCanaryBusy(true);
    const r = await canaryStaffStop(session.access_token);
    setCanaryBusy(false);
    if (!r.ok) return toast({ title: r.error, variant: 'destructive' });
    setCanaryPlainCode(null);
    toast({ title: 'Canary session ended' });
    void loadCanary();
  };

  const copyCanaryCode = async () => {
    if (!canaryPlainCode) return;
    try {
      await navigator.clipboard.writeText(canaryPlainCode);
      toast({ title: 'Code copied' });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  const newStaffMatches = newStaffQuery.length >= 2
    ? profiles.filter((p) =>
        !staff.some((s) => s.user_id === p.user_id) &&
        ((p.display_name || '').toLowerCase().includes(newStaffQuery.toLowerCase()) ||
         (p.discord_username || '').toLowerCase().includes(newStaffQuery.toLowerCase()))
      ).slice(0, 6)
    : [];

  const tabParam = searchParams.get('tab');
  const staffPanelTabs = [
    'members',
    'servers',
    'openings',
    'reports',
    ...(access.isSiteOwner ? (['audit'] as const) : []),
    'canary',
    'staff',
    'discord',
  ] as const;
  const tabFromUrl =
    access.canModerate &&
    tabParam &&
    (staffPanelTabs as readonly string[]).includes(tabParam) &&
    (tabParam !== 'audit' || access.isSiteOwner)
      ? tabParam
      : null;
  const defaultTab = tabFromUrl ?? (access.isSiteOwner ? 'members' : 'openings');

  const ownerOnlyTitle = 'Only the site owner account can use this.';

  const confirmStaffDlg = async () => {
    if (!staffDlg) return;
    const reason = staffDlgReason.trim();
    if (reason.length < 10) {
      toast({ title: 'Reason must be at least 10 characters.', variant: 'destructive' });
      return;
    }
    setStaffDlgBusy(true);
    try {
      await staffDlg.submit(reason);
      toast({ title: 'Done' });
      setStaffDlg(null);
      setStaffDlgReason('');
      await refresh();
      await loadAuditLogs();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Action failed', variant: 'destructive' });
    } finally {
      setStaffDlgBusy(false);
    }
  };

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

        <Tabs key={`${access.isSiteOwner ? 'owner' : 'staff'}-${defaultTab}`} defaultValue={defaultTab}>
          <TabsList className="mb-4 flex flex-wrap">
            {access.canModerate && (
              <>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="servers">Servers</TabsTrigger>
              </>
            )}
            <TabsTrigger value="openings">Posts</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            {access.isSiteOwner && (
              <TabsTrigger value="audit" className="gap-1.5">
                <ScrollText className="h-3.5 w-3.5" /> Audit
              </TabsTrigger>
            )}
            {access.canModerate && (
              <>
                <TabsTrigger value="canary" className="gap-1.5">
                  <Bird className="h-3.5 w-3.5" /> Canary
                </TabsTrigger>
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

          {access.canModerate && (
          <TabsContent value="members" className="space-y-2">
            {!access.isSiteOwner ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                Use <strong className="text-foreground">Reason</strong> prompts for verify, pin, Pro, delete, or ban.
                Combined bans and profile removals are limited to <strong className="text-foreground">two per hour</strong>{' '}
                (site owner exempt). Audit entries are visible only to the site owner.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                Site owner shortcuts use database RPCs. Other staff use audited actions with required reasons.
              </p>
            )}
            {filter(profiles, ['display_name', 'discord_username']).map((p) => {
              const targetIsOwner = isSiteOwnerDiscordUsername(p.discord_username ?? null);
              const isSelf = p.user_id === user?.id;
              return (
              <Card key={p.id}><CardContent className="p-3 flex flex-wrap items-center gap-2 sm:gap-3">
                <Avatar className="h-9 w-9 shrink-0"><AvatarImage src={p.discord_avatar || undefined} /><AvatarFallback>{p.display_name?.[0] || '?'}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0 basis-[140px]">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">{p.display_name || 'Member'}
                    {p.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-verified shrink-0" />}
                    {p.is_featured && <Crown className="h-3.5 w-3.5 text-featured shrink-0" />}
                    {p.is_pro && <Sparkles className="h-3.5 w-3.5 text-amber-200/90 shrink-0" aria-hidden />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">@{p.discord_username || '—'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-end ml-auto">
                {access.isSiteOwner ? (
                  <>
                    <Button
                      size="sm"
                      variant={p.is_verified ? 'default' : 'outline'}
                      onClick={() => toggleVerified(p)}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />{p.is_verified ? 'Verified' : 'Verify'}
                    </Button>
                    <Button
                      size="sm"
                      variant={p.is_featured ? 'default' : 'outline'}
                      onClick={() => toggleFeatured(p)}
                      className="gap-1"
                    >
                      <Crown className="h-3.5 w-3.5" />{p.is_featured ? 'Pinned' : 'Pin'}
                    </Button>
                    <Button
                      size="sm"
                      variant={p.is_pro ? 'default' : 'outline'}
                      onClick={() => toggleProOwner(p)}
                      className="gap-1"
                    >
                      <Sparkles className="h-3.5 w-3.5" />{p.is_pro ? 'Pro' : 'Grant Pro'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeProfile(p)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant={p.is_verified ? 'default' : 'outline'}
                      onClick={() => {
                        setStaffDlgReason('');
                        setStaffDlg({
                          title: `${p.is_verified ? 'Remove' : 'Grant'} verified — ${p.display_name || p.discord_username || 'member'}`,
                          submit: async (reason) => {
                            const r = await callModerationFn('staff-directory-action', {
                              action: 'set_profile_flags',
                              profile_id: p.id,
                              profile_patch: { is_verified: !p.is_verified },
                              reason,
                            });
                            if (!r.ok) throw new Error(r.error);
                            setProfiles((prev) =>
                              prev.map((x) => (x.id === p.id ? { ...x, is_verified: !p.is_verified } : x)),
                            );
                          },
                        });
                      }}
                      className="gap-1"
                      disabled={targetIsOwner}
                      title={targetIsOwner ? 'Cannot change site owner flags' : undefined}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />{p.is_verified ? 'Verified' : 'Verify'}
                    </Button>
                    <Button
                      size="sm"
                      variant={p.is_featured ? 'default' : 'outline'}
                      onClick={() => {
                        setStaffDlgReason('');
                        setStaffDlg({
                          title: `${p.is_featured ? 'Unpin' : 'Pin'} — ${p.display_name || p.discord_username || 'member'}`,
                          submit: async (reason) => {
                            const r = await callModerationFn('staff-directory-action', {
                              action: 'set_profile_flags',
                              profile_id: p.id,
                              profile_patch: { is_featured: !p.is_featured },
                              reason,
                            });
                            if (!r.ok) throw new Error(r.error);
                            setProfiles((prev) =>
                              prev.map((x) => (x.id === p.id ? { ...x, is_featured: !p.is_featured } : x)),
                            );
                          },
                        });
                      }}
                      className="gap-1"
                      disabled={targetIsOwner}
                      title={targetIsOwner ? 'Cannot change site owner flags' : undefined}
                    >
                      <Crown className="h-3.5 w-3.5" />{p.is_featured ? 'Pinned' : 'Pin'}
                    </Button>
                    <Button
                      size="sm"
                      variant={p.is_pro ? 'default' : 'outline'}
                      onClick={() => {
                        setStaffDlgReason('');
                        setStaffDlg({
                          title: `${p.is_pro ? 'Revoke' : 'Grant'} Pro — ${p.display_name || p.discord_username || 'member'}`,
                          submit: async (reason) => {
                            const r = await callModerationFn('staff-directory-action', {
                              action: 'set_profile_flags',
                              profile_id: p.id,
                              profile_patch: { is_pro: !p.is_pro },
                              reason,
                            });
                            if (!r.ok) throw new Error(r.error);
                            setProfiles((prev) =>
                              prev.map((x) => (x.id === p.id ? { ...x, is_pro: !p.is_pro } : x)),
                            );
                          },
                        });
                      }}
                      className="gap-1"
                      disabled={targetIsOwner}
                      title={targetIsOwner ? 'Cannot change site owner flags' : undefined}
                    >
                      <Sparkles className="h-3.5 w-3.5" />{p.is_pro ? 'Pro' : 'Pro'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setStaffDlgReason('');
                        setStaffDlg({
                          title: `Delete profile — ${p.display_name || p.discord_username || 'member'}`,
                          submit: async (reason) => {
                            const r = await callModerationFn('staff-directory-action', {
                              action: 'remove_profile',
                              profile_id: p.id,
                              reason,
                            });
                            if (!r.ok) throw new Error(r.error);
                            setProfiles((prev) => prev.filter((x) => x.id !== p.id));
                          },
                        });
                      }}
                      className="text-destructive"
                      disabled={targetIsOwner || isSelf}
                      title={targetIsOwner ? 'Cannot delete site owner' : isSelf ? 'Cannot delete yourself' : undefined}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive border-destructive/40"
                      disabled={targetIsOwner || isSelf || !p.user_id}
                      title={targetIsOwner ? 'Cannot ban site owner' : isSelf ? 'Cannot ban yourself' : !p.user_id ? 'No login' : undefined}
                      onClick={() => {
                        setStaffDlgReason('');
                        setStaffDlg({
                          title: `Ban member — ${p.display_name || p.discord_username || 'member'}`,
                          submit: async (reason) => {
                            const r = await callModerationFn('staff-directory-action', {
                              action: 'ban_profile',
                              profile_id: p.id,
                              reason,
                            });
                            if (!r.ok) throw new Error(r.error);
                            setProfiles((prev) => prev.filter((x) => x.id !== p.id));
                          },
                        });
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" /> Ban
                    </Button>
                  </>
                )}
                </div>
              </CardContent></Card>
            );})}
          </TabsContent>
          )}

          {access.canModerate && (
          <TabsContent value="servers" className="space-y-2">
            {!access.isSiteOwner ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                Force-verify or delete servers with a logged reason (audit visible to site owner only).
              </p>
            ) : null}
            {filter(servers, ['name']).map((s) => (
              <Card key={s.id}><CardContent className="p-3 flex flex-wrap items-center gap-2 sm:gap-3">
                <Avatar className="h-9 w-9 rounded-md shrink-0"><AvatarImage src={s.icon || undefined} /><AvatarFallback className="rounded-md">{s.name?.[0]}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0 basis-[120px]">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {s.name}
                    {s.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-verified shrink-0" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.member_count || 0} members</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end ml-auto">
                {access.isSiteOwner ? (
                  <>
                    <Button
                      size="sm"
                      variant={s.is_verified ? 'default' : 'outline'}
                      onClick={() => toggleServerVerified(s)}
                      className="gap-1 shrink-0"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />{s.is_verified ? 'Verified' : 'Verify'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeServer(s)}
                      className="text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant={s.is_verified ? 'default' : 'outline'}
                      onClick={() => {
                        setStaffDlgReason('');
                        setStaffDlg({
                          title: `${s.is_verified ? 'Remove' : 'Force'} server verification — ${s.name}`,
                          submit: async (reason) => {
                            const r = await callModerationFn('staff-directory-action', {
                              action: 'set_server_verified',
                              server_id: s.id,
                              is_verified: !s.is_verified,
                              reason,
                            });
                            if (!r.ok) throw new Error(r.error);
                            setServers((prev) =>
                              prev.map((x) => (x.id === s.id ? { ...x, is_verified: !s.is_verified } : x)),
                            );
                          },
                        });
                      }}
                      className="gap-1 shrink-0"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />{s.is_verified ? 'Verified' : 'Verify'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setStaffDlgReason('');
                        setStaffDlg({
                          title: `Delete server listing — ${s.name}`,
                          submit: async (reason) => {
                            const r = await callModerationFn('staff-directory-action', {
                              action: 'delete_server',
                              server_id: s.id,
                              reason,
                            });
                            if (!r.ok) throw new Error(r.error);
                            setServers((prev) => prev.filter((x) => x.id !== s.id));
                          },
                        });
                      }}
                      className="text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                </div>
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

          <TabsContent value="reports" className="space-y-2">
            {filter(reports, ['reason', 'reporter_label', 'kind', 'report_category', 'server_label', 'message_preview']).length ===
            0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No user reports yet. Reports appear when someone uses Report on a review, DM, or server.
                </CardContent>
              </Card>
            ) : (
              filter(reports, ['reason', 'reporter_label', 'kind', 'report_category', 'server_label', 'message_preview']).map(
                (r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {r.kind}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {reportCategoryLabel(r.report_category)}
                        </Badge>
                        <Badge
                          variant={
                            r.status === 'open' ? 'secondary' : r.status === 'resolved' ? 'default' : 'outline'
                          }
                          className="capitalize text-[10px]"
                        >
                          {r.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        From <span className="text-foreground font-medium">{r.reporter_label}</span>
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.reason}</p>
                      {r.message_preview && (
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                          <p className="text-muted-foreground mb-1">
                            Message from <span className="text-foreground">{r.message_sender_label}</span>
                          </p>
                          <p className="text-foreground/90 whitespace-pre-wrap">{r.message_preview}</p>
                        </div>
                      )}
                      {r.server_label && (
                        <p className="text-xs text-muted-foreground">
                          Server: <span className="text-foreground font-medium">{r.server_label}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground font-mono">
                        {r.review_id && <span>review: {r.review_id}</span>}
                        {r.message_id && <span>message: {r.message_id}</span>}
                        {r.conversation_id && <span>conversation: {r.conversation_id}</span>}
                        {r.server_id && <span>server: {r.server_id}</span>}
                      </div>
                      {r.status === 'open' && (
                        <>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {r.kind === 'message' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                                onClick={() => void staffReportAction(r, 'delete_message')}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete message
                              </Button>
                            )}
                            {r.kind === 'review' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                                onClick={() => void staffReportAction(r, 'delete_review')}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete review
                              </Button>
                            )}
                            {r.kind === 'server' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                                onClick={() => {
                                  if (access.isSiteOwner) {
                                    void staffReportAction(r, 'remove_server');
                                    return;
                                  }
                                  setReportModReason('');
                                  setReportMod({ row: r, action: 'remove_server' });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Remove server
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1"
                              onClick={() => {
                                setWarnForReportId(r.id);
                                setWarnBody('');
                              }}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" /> Warn member
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1 text-destructive"
                              onClick={() => {
                                if (access.isSiteOwner) {
                                  void staffReportAction(r, 'ban');
                                  return;
                                }
                                setReportModReason('');
                                setReportMod({ row: r, action: 'ban' });
                              }}
                            >
                              <Ban className="h-3.5 w-3.5" /> Ban member
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1"
                              onClick={() => void resolveReport(r, 'resolved')}
                            >
                              <Check className="h-3.5 w-3.5" /> Mark handled
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void resolveReport(r, 'dismissed')}>
                              Dismiss
                            </Button>
                          </div>
                          {reportMod && reportMod.row.id === r.id && (
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Staff audit reason ({access.isSiteOwner ? 'optional for you; ' : ''}10+ characters for
                                other staff)
                              </p>
                              <Textarea
                                value={reportModReason}
                                onChange={(e) => setReportModReason(e.target.value)}
                                rows={3}
                                maxLength={2000}
                                className="rounded-lg border-white/12 bg-background resize-none text-sm"
                                placeholder="Why you are taking this action…"
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void staffReportAction(r, reportMod.action, {
                                      reason: reportModReason.trim() || undefined,
                                    })
                                  }
                                  disabled={!access.isSiteOwner && reportModReason.trim().length < 10}
                                >
                                  Confirm & resolve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setReportMod(null);
                                    setReportModReason('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                          {warnForReportId === r.id && (
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-2">
                              <p className="text-xs text-muted-foreground">Warning text (visible on their profile)</p>
                              <Textarea
                                value={warnBody}
                                onChange={(e) => setWarnBody(e.target.value)}
                                rows={3}
                                maxLength={2000}
                                className="rounded-lg border-white/12 bg-background resize-none text-sm"
                                placeholder="Reason for warning…"
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => void staffReportAction(r, 'warn', { warn_body: warnBody.trim() })}
                                  disabled={warnBody.trim().length < 1}
                                >
                                  Send warning & resolve
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setWarnForReportId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ),
              )
            )}
          </TabsContent>

          {access.isSiteOwner && (
            <TabsContent value="audit" className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Immutable log of moderation and staff directory actions. Only your site owner account can read this
                table.
              </p>
              {auditLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading audit…</p>
              ) : auditLogs.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    No audit entries yet. Apply the staff_audit_logs migration and perform a staff action.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                  {auditLogs.map((row) => (
                    <Card key={row.id}>
                      <CardContent className="p-3 space-y-1.5 text-sm">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{new Date(row.created_at).toLocaleString()}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {row.action}
                          </Badge>
                          {row.report_id && (
                            <span className="font-mono text-[10px]">report {String(row.report_id).slice(0, 8)}…</span>
                          )}
                        </div>
                        <p className="text-foreground/95 whitespace-pre-wrap leading-relaxed">{row.reason}</p>
                        <div className="text-[10px] text-muted-foreground font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                          {row.actor_profile_id && <span>actor profile: {row.actor_profile_id}</span>}
                          {row.target_profile_id && <span>target profile: {row.target_profile_id}</span>}
                          {!row.target_profile_id &&
                            (row.metadata as { deleted_profile_id?: string } | null)?.deleted_profile_id && (
                              <span>
                                deleted profile:{' '}
                                {(row.metadata as { deleted_profile_id: string }).deleted_profile_id}
                              </span>
                            )}
                          {row.target_server_id && <span>target server: {row.target_server_id}</span>}
                          {!row.target_server_id &&
                            (row.metadata as { deleted_server_id?: string } | null)?.deleted_server_id && (
                              <span>
                                deleted server:{' '}
                                {(row.metadata as { deleted_server_id: string }).deleted_server_id}
                              </span>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {access.canModerate && (
            <TabsContent value="canary" className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Bird className="h-5 w-5" /> Canary pre-release
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Point DNS and Vercel at <strong className="text-foreground">canary.erlc.directory</strong> (same
                      build or a preview deployment). When you start a session, testers must enter the one-time test code
                      on the canary site before it loads. Stop the session to revoke everyone immediately.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm space-y-2">
                    <p>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      {canaryActive ? (
                        <span className="text-emerald-400 font-medium">Active</span>
                      ) : (
                        <span className="text-zinc-400">No session</span>
                      )}
                    </p>
                    {canaryActive && canaryStartedAt && (
                      <p className="text-xs text-muted-foreground">
                        Started {new Date(canaryStartedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {canaryPlainCode && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                      <p className="text-xs font-medium text-amber-200/90">Test code (copy now — not shown again)</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-lg font-mono tracking-widest text-foreground">{canaryPlainCode}</code>
                        <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={() => void copyCanaryCode()}>
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={canaryBusy || canaryActive} onClick={() => void startCanarySession()}>
                      Start testing session
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={canaryBusy || !canaryActive}
                      onClick={() => void stopCanarySession()}
                    >
                      Stop session
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requires Edge Function <code className="rounded bg-white/10 px-1">canary-session</code> deployed on
                    Supabase. Signing uses optional secret <code className="rounded bg-white/10 px-1">CANARY_SIGNING_SECRET</code>{' '}
                    (16+ chars); if unset, the function derives a key from the service role automatically. Optional:{' '}
                    <code className="rounded bg-white/10 px-1">SITE_OWNER_DISCORD_USERNAME</code> for staff checks.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {access.canModerate && (
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
                {!access.isSiteOwner && (
                  <p className="text-sm text-muted-foreground rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    Broadcast is limited to the site owner account.
                  </p>
                )}
                <Textarea
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Short announcement (max 1800 characters)…"
                  rows={5}
                  maxLength={1800}
                  className="rounded-xl border-white/12 bg-white/[0.04] resize-none"
                  disabled={!access.isSiteOwner}
                  title={!access.isSiteOwner ? ownerOnlyTitle : undefined}
                />
                <p className="text-xs text-muted-foreground text-right tabular-nums">{broadcastText.length}/1800</p>
                <Button
                  type="button"
                  disabled={broadcasting || !broadcastText.trim() || !access.isSiteOwner}
                  title={!access.isSiteOwner ? ownerOnlyTitle : undefined}
                  onClick={() => void sendDiscordBroadcast()}
                >
                  {broadcasting ? 'Sending…' : 'Send to opted-in users'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {access.canModerate && (
          <TabsContent value="staff" className="space-y-3">
            {!access.isSiteOwner && (
              <p className="text-sm text-muted-foreground rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                Granting or revoking admin roles is limited to the site owner.
              </p>
            )}
            <Card><CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add a staff member</p>
              <Input
                value={newStaffQuery}
                onChange={(e) => setNewStaffQuery(e.target.value)}
                placeholder="Search by name or Discord username…"
                disabled={!access.isSiteOwner}
                title={!access.isSiteOwner ? ownerOnlyTitle : undefined}
              />
              {newStaffMatches.length > 0 && (
                <div className="space-y-1">
                  {newStaffMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!access.isSiteOwner}
                      title={!access.isSiteOwner ? ownerOnlyTitle : undefined}
                      onClick={() => addStaff(p)}
                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 text-left disabled:opacity-50 disabled:pointer-events-none"
                    >
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
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeStaff(row)}
                  className="text-destructive"
                  disabled={!access.isSiteOwner}
                  title={!access.isSiteOwner ? ownerOnlyTitle : undefined}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardContent></Card>
            ))}
          </TabsContent>
          )}
        </Tabs>

        <Dialog
          open={!!staffDlg}
          onOpenChange={(o) => {
            if (!o) {
              setStaffDlg(null);
              setStaffDlgReason('');
            }
          }}
        >
          <DialogContent className="sm:max-w-lg border-white/12 bg-background">
            <DialogHeader>
              <DialogTitle>{staffDlg?.title ?? 'Staff action'}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Stored in the audit log. Minimum 10 characters. Site owner sees all entries under the Audit tab.
            </p>
            <Textarea
              value={staffDlgReason}
              onChange={(e) => setStaffDlgReason(e.target.value)}
              rows={4}
              maxLength={2000}
              className="border-white/12 bg-white/[0.04] resize-none text-sm"
              placeholder="Explain why you are taking this action…"
            />
            <p className="text-[10px] text-muted-foreground text-right tabular-nums">{staffDlgReason.length}/2000</p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStaffDlg(null);
                  setStaffDlgReason('');
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={staffDlgBusy || staffDlgReason.trim().length < 10} onClick={() => void confirmStaffDlg()}>
                {staffDlgBusy ? 'Working…' : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Admin;
