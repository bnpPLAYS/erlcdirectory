import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Server, Plus, SlidersHorizontal } from 'lucide-react';
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
import CreateServerDialog from '@/components/server/CreateServerDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ServerData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  member_count: number;
  staff_count: number;
  is_verified: boolean;
  is_featured: boolean;
  is_hiring: boolean;
  tags: string[];
  discord_invite: string | null;
}

const Servers = () => {
  const { user } = useAuth();
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
      .select('id, name, description, icon, member_count, staff_count, is_verified, is_featured, is_hiring, tags');

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
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Server className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">ER:LC Servers</h1>
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
              {user && <CreateServerDialog onCreated={fetchServers} />}
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
                <Server className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">No servers listed yet</h3>
                <p className="text-muted-foreground mb-6">
                  List your server so applicants can see what you offer and how to join.
                </p>
                {user ? (
                  <CreateServerDialog onCreated={fetchServers} />
                ) : (
                  <Link to="/auth">
                    <Button className="gap-2">Sign in to list a server</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

export default Servers;
