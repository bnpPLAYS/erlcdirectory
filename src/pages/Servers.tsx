import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import ServerCard from '@/components/server/ServerCard';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { pageHeroEnter } from '@/lib/pageHero';
import SiteFooter from '@/components/layout/SiteFooter';

interface ServerData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  banner: string | null;
  member_count: number;
  staff_count: number;
  is_verified: boolean;
  is_featured: boolean;
  is_hiring: boolean;
  tags: string[];
  discord_invite: string | null;
}

const Servers = () => {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [filterHiring, setFilterHiring] = useState(false);

  useEffect(() => {
    fetchServers();
  }, [sortBy]);

  const fetchServers = async () => {
    setLoading(true);
    let query = supabase
      .from('servers')
      .select('id, name, description, icon, banner, member_count, staff_count, is_verified, is_featured, is_hiring, tags, discord_invite');

    if (sortBy === 'featured') {
      query = query.order('is_featured', { ascending: false }).order('member_count', { ascending: false });
    } else if (sortBy === 'members') {
      query = query.order('member_count', { ascending: false });
    } else if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(50);

    if (!error && data) {
      setServers(data);
    }
    setLoading(false);
  };

  const filteredServers = servers.filter(server => {
    const matchesSearch = !searchQuery || 
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesHiring = !filterHiring || server.is_hiring;
    
    return matchesSearch && matchesHiring;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
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
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Servers</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Browse active communities, hiring status, and Discord links in one place.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by server name or description..."
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
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="members">Largest</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
              
            </div>

            {/* Quick filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge
                variant={!filterHiring ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilterHiring(false)}
              >
                All
              </Badge>
              <Badge
                variant={filterHiring ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilterHiring(true)}
              >
                Hiring now
              </Badge>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="h-48 animate-pulse bg-muted" />
              ))}
            </div>
          ) : filteredServers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredServers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
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
                <h3 className="text-xl font-semibold mb-2">No servers listed yet</h3>
                <p className="text-muted-foreground">
                  Servers appear automatically once a member's experience is verified by a Discord admin.
                </p>

              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Servers;
