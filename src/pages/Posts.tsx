import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Heart, MessageCircle, Pin, Briefcase, User, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Navbar from '@/components/layout/Navbar';
import { mockPosts, formatTimeAgo, type Post } from '@/lib/mockData';

const PostTypeColors: Record<string, string> = {
  hiring: 'bg-primary/20 text-primary border-primary/30',
  availability: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  looking: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  announcement: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const PostTypeLabels: Record<string, string> = {
  hiring: 'Hiring',
  availability: 'Available',
  looking: 'Looking',
  announcement: 'Announcement',
};

const PostCard = ({ post }: { post: Post }) => {
  return (
    <Card className={`card-interactive ${post.isSticky ? 'border-primary/30' : ''}`}>
      {post.isSticky && (
        <div className="px-4 py-2 border-b border-border/50 bg-primary/5 flex items-center gap-2 text-xs text-primary">
          <Pin className="h-3 w-3" />
          Pinned Post
        </div>
      )}
      <CardContent className="p-4">
        {/* Author */}
        <div className="flex items-center gap-3 mb-3">
          <Link to={`/profile/${post.author.id}`}>
            <Avatar className="h-10 w-10 ring-1 ring-border hover:ring-primary/50 transition-all">
              <AvatarImage src={post.author.avatarUrl} />
              <AvatarFallback>{post.author.displayName[0]}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link to={`/profile/${post.author.id}`} className="font-medium hover:text-primary transition-colors truncate">
                {post.author.displayName}
              </Link>
              <Badge className={`${PostTypeColors[post.type]} text-[10px] px-1.5 py-0`}>
                {PostTypeLabels[post.type]}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{post.author.discordUsername}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimeAgo(post.createdAt)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <h3 className="font-semibold mb-2">{post.title}</h3>
        <p className="text-sm text-muted-foreground mb-3">{post.content}</p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-4 pt-3 border-t border-border/50">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
            <Heart className="h-3.5 w-3.5" />
            {post.likes}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comments}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Posts = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredPosts = mockPosts.filter(post => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!post.title.toLowerCase().includes(query) && 
          !post.content.toLowerCase().includes(query) &&
          !post.author.displayName.toLowerCase().includes(query)) {
        return false;
      }
    }
    if (activeFilter && post.type !== activeFilter) {
      return false;
    }
    return true;
  });

  const stickyPosts = filteredPosts.filter(p => p.isSticky);
  const regularPosts = filteredPosts.filter(p => !p.isSticky);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Posts & Applications</h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Announcements, availability posts, and job listings from the community
            </p>
          </div>
          
          {/* Search */}
          <div className="max-w-xl mx-auto mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <Button
              variant={activeFilter === null ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs"
              onClick={() => setActiveFilter(null)}
            >
              All Posts
            </Button>
            <Button
              variant={activeFilter === 'hiring' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setActiveFilter('hiring')}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Hiring
            </Button>
            <Button
              variant={activeFilter === 'availability' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setActiveFilter('availability')}
            >
              <User className="h-3.5 w-3.5" />
              Available
            </Button>
            <Button
              variant={activeFilter === 'looking' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setActiveFilter('looking')}
            >
              <Search className="h-3.5 w-3.5" />
              Looking
            </Button>
          </div>
        </div>
      </section>

      {/* Posts */}
      <section className="pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Create Post CTA */}
            <Card className="border-dashed">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Share your availability or post an opening...</span>
                </div>
                <Link to="/auth">
                  <Button size="sm">Create Post</Button>
                </Link>
              </CardContent>
            </Card>
            
            {/* Sticky Posts */}
            {stickyPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            
            {/* Regular Posts */}
            {regularPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            
            {filteredPosts.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="font-semibold mb-1">No posts found</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Posts;
