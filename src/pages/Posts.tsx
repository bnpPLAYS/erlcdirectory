import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, Plus, Briefcase, User, Megaphone, MessageCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Navbar from '@/components/layout/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatTimeAgo } from '@/lib/mockData';

interface Post {
  id: string;
  type: string;
  title: string;
  content: string;
  is_open: boolean;
  view_count: number;
  application_count: number;
  created_at: string;
  profiles: {
    display_name: string | null;
    discord_avatar: string | null;
    is_verified: boolean;
  } | null;
}

const postTypeConfig: Record<string, { label: string; icon: typeof Briefcase; color: string }> = {
  hiring: { label: 'Hiring', icon: Briefcase, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  looking: { label: 'Looking for work', icon: User, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  announcement: { label: 'Announcement', icon: Megaphone, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  discussion: { label: 'Discussion', icon: MessageCircle, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

const Posts = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, type, title, content, is_open, view_count, application_count, created_at,
        profiles!author_id(display_name, discord_avatar, is_verified)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setPosts(data as Post[]);
    }
    setLoading(false);
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = !searchQuery || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !activeFilter || post.type === activeFilter;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Openings & Updates</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Hiring posts, staff searches, and server updates from the ER:LC community.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search openings and updates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {user && (
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Post
                </Button>
              )}
            </div>

            {/* Type filters */}
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
                  className="cursor-pointer gap-1"
                  onClick={() => setActiveFilter(type)}
                >
                  <config.icon className="h-3 w-3" />
                  {config.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="space-y-4 max-w-2xl mx-auto">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="h-32 animate-pulse bg-muted" />
              ))}
            </div>
          ) : filteredPosts.length > 0 ? (
            <div className="space-y-4 max-w-2xl mx-auto">
              {filteredPosts.map((post) => {
                const typeConfig = postTypeConfig[post.type];
                return (
                  <Card key={post.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={post.profiles?.discord_avatar || undefined} />
                          <AvatarFallback>{post.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {typeConfig && (
                              <Badge className={typeConfig.color}>
                                <typeConfig.icon className="h-3 w-3 mr-1" />
                                {typeConfig.label}
                              </Badge>
                            )}
                            <Badge variant="outline" className={post.is_open ? 'text-green-400' : 'text-red-400'}>
                              {post.is_open ? 'Open' : 'Closed'}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(post.created_at)}
                            </span>
                          </div>
                          <h3 className="font-semibold mb-1">{post.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{post.profiles?.display_name || 'Discord member'}</span>
                            <span>• {post.view_count} views</span>
                            {post.application_count > 0 && (
                              <span>• {post.application_count} applications</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed max-w-2xl mx-auto">
              <CardContent className="p-12 text-center">
                <FileText className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start the board with a hiring post, application, or community update.
                </p>
                <Link to={user ? "#" : "/auth"}>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {user ? 'Create the first post' : 'Sign in to post'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

export default Posts;
