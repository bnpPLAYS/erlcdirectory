import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, UserPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import VerifiedBadge from '@/components/ui/verified-badge';

interface Connection {
  id: string;
  display_name: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
  skills: string[];
}

const Connections = () => {
  const { user, profile, loading } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      // Fetch connections when authenticated
      // For now, this will be empty since connections need to be implemented
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary-foreground" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Connections</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Connect and message other ERLC professionals
              </p>
            </div>
            
            <div className="max-w-2xl mx-auto">
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Users className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">Sign In to Connect</h3>
                  <p className="text-muted-foreground mb-6">
                    Create an account to start connecting with other professionals.
                  </p>
                  <Link to="/auth">
                    <Button className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Sign In with Discord
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const filteredConnections = connections.filter(conn => 
    !searchQuery || conn.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Your Connections</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              People you've connected with on ERLC Directory
            </p>
          </div>

          {/* Search */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search connections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Connections List */}
          {filteredConnections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {filteredConnections.map((connection) => (
                <Card key={connection.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={connection.discord_avatar || undefined} />
                        <AvatarFallback>{connection.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{connection.display_name}</span>
                          {connection.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {connection.bio || 'No bio'}
                        </p>
                      </div>
                      <Link to={`/messages?user=${connection.id}`}>
                        <Button variant="ghost" size="icon">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed max-w-2xl mx-auto">
              <CardContent className="p-12 text-center">
                <Users className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">No Connections Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Browse profiles and connect with other ERLC professionals.
                </p>
                <Link to="/browse">
                  <Button className="gap-2">
                    <Search className="h-4 w-4" />
                    Browse Profiles
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

export default Connections;
