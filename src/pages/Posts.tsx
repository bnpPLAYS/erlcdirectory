import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Clock,
  ExternalLink,
  Server as ServerIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import CreatePostDialog from '@/components/posts/CreatePostDialog';
import { PostComments } from '@/components/posts/PostComments';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatTimeAgo } from '@/lib/mockData';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { pageHeroEnter } from '@/lib/pageHero';
import { profilePath } from '@/lib/profilePath';
import { fetchDiscordGuilds } from '@/lib/fetchDiscordGuilds';
import { normalizeDiscordInvite } from '@/lib/discordInvite';
import { isMissingPostsColumnError } from '@/lib/postsSchemaCompat';
import { cn } from '@/lib/utils';

const POSTS_SELECT_WITH_ROBLOX = `
        id, type, title, content, status, is_open, view_count, application_count, created_at, server_id,
        application_url, require_guild_membership, require_roblox_verified, requirements,
        profiles!author_id(id, discord_username, display_name, discord_avatar, discord_id, is_verified),
        servers(id, name, icon, discord_invite, guild_id)
      `;

const POSTS_SELECT_SANS_ROBLOX = `
        id, type, title, content, status, is_open, view_count, application_count, created_at, server_id,
        application_url, require_guild_membership, requirements,
        profiles!author_id(id, discord_username, display_name, discord_avatar, discord_id, is_verified),
        servers(id, name, icon, discord_invite, guild_id)
      `;

interface Post {
  id: string;
  type: string;
  title: string;
  content: string;
  status?: string;
  is_open: boolean;
  view_count: number;
  application_count: number;
  created_at: string;
  server_id: string | null;
  application_url: string | null;
  require_guild_membership: boolean;
  require_roblox_verified?: boolean;
  requirements: string[] | null;
  profiles: {
    id: string;
    discord_username?: string | null;
    display_name: string | null;
    discord_avatar: string | null;
    discord_id: string | null;
    is_verified: boolean;
  } | null;
  servers: {
    id: string;
    name: string;
    icon: string | null;
    discord_invite: string | null;
    guild_id: string | null;
  } | null;
}

const postTypeConfig: Record<string, { label: string; badgeClass: string }> = {
  hiring: {
    label: 'Hiring',
    badgeClass: 'border-violet-400/35 bg-violet-500/12 text-violet-200',
  },
  looking: {
    label: 'Looking for work',
    badgeClass: 'border-white/18 bg-white/[0.07] text-foreground/90',
  },
  announcement: {
    label: 'Announcement',
    badgeClass: 'border-white/15 bg-white/[0.05] text-muted-foreground',
  },
  discussion: {
    label: 'Discussion',
    badgeClass: 'border-sky-400/35 bg-sky-500/12 text-sky-200',
  },
};

const Posts = () => {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    let { data, error } = await supabase
      .from('posts')
      .select(POSTS_SELECT_WITH_ROBLOX)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error && isMissingPostsColumnError(error.message, 'require_roblox_verified')) {
      const second = await supabase
        .from('posts')
        .select(POSTS_SELECT_SANS_ROBLOX)
        .order('created_at', { ascending: false })
        .limit(50);
      data = second.data;
      error = second.error;
    }

    if (!error && data) {
      setPosts(
        (data as Post[]).map((p) => ({
          ...p,
          require_roblox_verified: p.require_roblox_verified ?? false,
        })),
      );
    }
    setLoading(false);
  };

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      !searchQuery ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = !activeFilter || post.type === activeFilter;

    return matchesSearch && matchesType;
  });

  const applyToHiring = async (post: Post) => {
    if (!user) {
      toast.error('Sign in with Discord to apply.');
      return;
    }
    if (post.require_guild_membership && post.servers?.guild_id) {
      let guilds: { id: string }[] = [];
      try {
        guilds = await fetchDiscordGuilds();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not verify Discord.');
        return;
      }
      const ok = guilds.some((g) => g.id === post.servers!.guild_id);
      if (!ok) {
        toast.error('Join the server on Discord first—this post requires membership.');
        return;
      }
    }
    if (post.require_roblox_verified) {
      if (!profile?.roblox_verified_at) {
        toast.error('This post requires a verified Roblox account. Use Edit profile → Continue with Roblox, then try again.');
        return;
      }
    }
    if (post.application_url) {
      window.open(post.application_url, '_blank', 'noopener,noreferrer');
    } else {
      toast.message('No application link', {
        description: 'Reach out via the server invite or Discord links on this post.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className={`text-center mb-10 ${pageHeroEnter}`}>
            <img
              src={logo}
              alt=""
              className="logo-mark mx-auto mb-6 h-14 w-14 object-contain sm:h-16 sm:w-16"
              width={64}
              height={64}
              decoding="async"
              aria-hidden
            />
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Posts</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Hiring, résumés, announcements, and discussions — with comments on every approved post.
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {user && <CreatePostDialog onCreated={fetchPosts} />}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Badge
                variant={activeFilter === null ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setActiveFilter(null)}
              >
                All
              </Badge>
              {Object.entries(postTypeConfig).map(([type, config]) => (
                <Badge
                  key={type}
                  variant={activeFilter === type ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setActiveFilter(type)}
                >
                  {config.label}
                </Badge>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 max-w-2xl mx-auto">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="h-32 animate-pulse bg-muted" />
              ))}
            </div>
          ) : filteredPosts.length > 0 ? (
            <div className="stagger-enter space-y-4 max-w-2xl mx-auto">
              {filteredPosts.map((post) => {
                const typeConfig = postTypeConfig[post.type];
                const serverInviteHref = normalizeDiscordInvite(post.servers?.discord_invite ?? null);
                return (
                  <Card key={post.id} className="hover-lift hover:border-primary/50 transition-colors border-white/10">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={post.profiles?.discord_avatar || undefined} />
                          <AvatarFallback>{post.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {typeConfig && (
                              <Badge variant="outline" className={cn('font-medium', typeConfig.badgeClass)}>
                                {typeConfig.label}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={
                                post.is_open
                                  ? 'border-white/20 text-foreground/90'
                                  : 'border-white/10 text-muted-foreground'
                              }
                            >
                              {post.is_open ? 'Open' : 'Closed'}
                            </Badge>
                            {profile?.id === post.profiles?.id && post.status === 'pending' && (
                              <Badge variant="outline" className="border-amber-400/35 text-amber-100">
                                Pending review
                              </Badge>
                            )}
                            {profile?.id === post.profiles?.id && post.status === 'rejected' && (
                              <Badge variant="destructive">Not approved</Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(post.created_at)}
                            </span>
                          </div>
                          <h3 className="font-semibold mb-1">{post.title}</h3>
                          {post.servers && (
                            <Link
                              to={`/server/${post.servers.id}`}
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 px-2 py-1 rounded bg-white/5"
                            >
                              {post.servers.icon ? (
                                <img src={post.servers.icon} alt="" className="h-3.5 w-3.5 rounded-sm" />
                              ) : (
                                <ServerIcon className="h-3 w-3" />
                              )}
                              {post.servers.name}
                            </Link>
                          )}
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">{post.content}</p>

                          {post.type === 'hiring' && post.requirements && post.requirements.length > 0 && (
                            <ul className="text-xs text-muted-foreground list-disc pl-4 mb-2 space-y-0.5">
                              {post.requirements.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          )}

                          {post.type === 'hiring' && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Button size="sm" variant="secondary" className="h-8" onClick={() => applyToHiring(post)}>
                                Apply
                              </Button>
                              {post.application_url && (
                                <span className="text-[11px] text-muted-foreground self-center">
                                  {post.require_guild_membership || post.require_roblox_verified
                                    ? [
                                        post.require_guild_membership && 'Discord membership',
                                        post.require_roblox_verified && 'Roblox verification',
                                      ]
                                        .filter(Boolean)
                                        .join(' and ') + ' may be checked before the form opens.'
                                    : 'Opens the application in a new tab.'}
                                </span>
                              )}
                            </div>
                          )}

                          {post.type === 'looking' && post.profiles?.id && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Button size="sm" variant="secondary" className="h-8" asChild>
                                <Link to={profilePath(post.profiles)}>View profile</Link>
                              </Button>
                              <Button size="sm" variant="outline" className="h-8" asChild>
                                <Link to={`/messages?with=${post.profiles.id}`}>Message</Link>
                              </Button>
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <Link
                              to={post.profiles ? profilePath(post.profiles) : '/browse'}
                              className="hover:text-foreground"
                            >
                              {post.profiles?.display_name || 'Discord member'}
                            </Link>
                            {serverInviteHref && (
                              <a
                                href={serverInviteHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground inline-flex items-center gap-1"
                                title="Open server invite"
                              >
                                <ExternalLink className="h-3 w-3" /> Server invite
                              </a>
                            )}
                            <span>• {post.view_count} views</span>
                            {post.application_count > 0 && (
                              <span>• {post.application_count} applications</span>
                            )}
                          </div>

                          <PostComments postId={post.id} postStatus={post.status ?? 'approved'} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed max-w-2xl mx-auto card-elevated">
              <CardContent className="p-12 text-center">
                <img
                  src={logo}
                  alt=""
                  className="logo-mark h-16 w-16 mx-auto mb-6 object-contain opacity-40"
                  width={64}
                  height={64}
                  aria-hidden
                />
                <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start the board with a hiring thread, looking-for-work post, announcement, or discussion — readers can
                  comment once a post is approved.
                </p>
                {user ? (
                  <CreatePostDialog onCreated={fetchPosts} />
                ) : (
                  <Link to="/auth">
                    <Button className="gap-2">Sign in to post</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Posts;
