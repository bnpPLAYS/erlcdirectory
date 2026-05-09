import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, SlidersHorizontal, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Navbar from '@/components/layout/Navbar';
import ProfileCard from '@/components/profile/ProfileCard';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  display_name: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  skills: string[];
  experiences?: Array<{
    id: string;
    role: string;
    server_name: string;
    server_icon: string | null;
    is_verified: boolean;
    guild_id: string | null;
    member_count?: number | null;
  }>;
  total_members?: number;
}

const Browse = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, [sortBy]);

  const fetchProfiles = async () => {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, display_name, discord_avatar, bio, is_verified, is_featured, rating, review_count, skills');

    if (sortBy === 'rating') {
      // Featured pinned to top, then highest rated
      query = query
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .order('review_count', { ascending: false });
    } else if (sortBy === 'newest') {
      query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(50);

    if (!error && data) {
      // Fetch experiences for these profiles
      const ids = data.map((p) => p.id);
      const { data: exps } = await supabase
        .from('experiences')
        .select('id, profile_id, role, server_name, server_icon, is_verified, guild_id, start_date')
        .in('profile_id', ids)
        .order('is_verified', { ascending: false })
        .order('start_date', { ascending: false });

      // Fetch server member counts by guild_id
      const guildIds = [...new Set((exps || []).map((e) => e.guild_id).filter(Boolean) as string[])];
      const { data: serverRows } = guildIds.length
        ? await supabase.from('servers').select('guild_id, member_count').in('guild_id', guildIds)
        : { data: [] as any[] };
      const memberByGuild = new Map<string, number>();
      (serverRows || []).forEach((s: any) => s.guild_id && memberByGuild.set(s.guild_id, s.member_count || 0));

      const enriched = data.map((p: any) => {
        const userExps = (exps || []).filter((e) => e.profile_id === p.id);
        const total = userExps.reduce(
          (sum, e) => sum + (e.guild_id ? memberByGuild.get(e.guild_id) || 0 : 0),
          0
        );
        return {
          ...p,
          experiences: userExps.map((e) => ({
            id: e.id,
            role: e.role,
            server_name: e.server_name,
            server_icon: e.server_icon,
            is_verified: e.is_verified,
            member_count: e.guild_id ? memberByGuild.get(e.guild_id) || 0 : 0,
          })),
          total_members: total,
        };
      });

      setProfiles(enriched);
    }
    setLoading(false);
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = !searchQuery || 
      profile.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.bio?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSkill = !selectedSkill || profile.skills?.includes(selectedSkill);
    
    return matchesSearch && matchesSkill;
  });

  const allSkills = [...new Set(profiles.flatMap(p => p.skills || []))];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Browse Members</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Find ER:LC staff, applicants, and server owners with real profile details.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members by name, bio, or skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-48">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured First</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Skill filters */}
            {allSkills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge
                  variant={selectedSkill === null ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedSkill(null)}
                >
                  All
                </Badge>
                {allSkills.slice(0, 10).map((skill) => (
                  <Badge
                    key={skill}
                    variant={selectedSkill === skill ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedSkill(skill)}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="h-64 animate-pulse bg-muted" />
              ))}
            </div>
          ) : filteredProfiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed max-w-2xl mx-auto">
              <CardContent className="p-12 text-center">
                <User className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">No members yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create the first profile so server owners know who you are and what you can do.
                </p>
                <Link to="/auth">
                  <Button className="gap-2">
                    Create Profile
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

export default Browse;
